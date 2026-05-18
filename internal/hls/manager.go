package hls

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Session struct {
	ID           string
	TempDir      string
	Cmd          *exec.Cmd
	Cancel       context.CancelFunc
	LastAccessed time.Time
	mu           sync.Mutex
}

func (s *Session) access() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.LastAccessed = time.Now()
}

func (s *Session) close() {
	if s.Cancel != nil {
		s.Cancel()
	}
	os.RemoveAll(s.TempDir)
}

type Manager struct {
	sessions map[string]*Session
	mu       sync.Mutex
	Timeout  time.Duration
}

func NewManager(timeout time.Duration) *Manager {
	m := &Manager{
		sessions: make(map[string]*Session),
		Timeout:  timeout,
	}
	go m.reaper()
	return m
}

func (m *Manager) reaper() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()
		now := time.Now()
		for id, s := range m.sessions {
			s.mu.Lock()
			idle := now.Sub(s.LastAccessed)
			s.mu.Unlock()

			if idle > m.Timeout {
				log.Printf("HLS Session %s timed out, cleaning up...", id)
				s.close()
				delete(m.sessions, id)
			}
		}
		m.mu.Unlock()
	}
}

func (m *Manager) StartSession(ctx context.Context, sourceURL string, headers http.Header) (*Session, error) {
	sessionID := fmt.Sprintf("%d", rand.Int63())

	tempDir, err := os.MkdirTemp("", "hydrui-hls-"+sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}

	execCtx, cancel := context.WithCancel(context.Background())

	// Build headers for ffmpeg input
	var headerArgs []string
	for k, v := range headers {
		headerArgs = append(headerArgs, fmt.Sprintf("%s: %s", k, strings.Join(v, ", ")))
	}
	headerStr := strings.Join(headerArgs, "\r\n") + "\r\n"

	args := []string{
		"-headers", headerStr,
		"-i", sourceURL,
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-c:a", "aac",
		"-f", "hls",
		"-hls_time", "6",
		"-hls_list_size", "0",
		filepath.Join(tempDir, "stream.m3u8"),
	}

	cmd := exec.CommandContext(execCtx, "ffmpeg", args...)

	if err := cmd.Start(); err != nil {
		cancel()
		os.RemoveAll(tempDir)
		return nil, fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	s := &Session{
		ID:           sessionID,
		TempDir:      tempDir,
		Cmd:          cmd,
		Cancel:       cancel,
		LastAccessed: time.Now(),
	}

	m.mu.Lock()
	m.sessions[sessionID] = s
	m.mu.Unlock()

	// Wait for process in background to handle exit correctly
	go func() {
		err := cmd.Wait()
		if err != nil && execCtx.Err() == nil {
			log.Printf("FFmpeg session %s exited with error: %v", sessionID, err)
		}
	}()

	// Polling wait for the m3u8 file to be generated
	m3u8Path := filepath.Join(tempDir, "stream.m3u8")
	for i := 0; i < 50; i++ { // waiting up to 5 seconds
		if _, err := os.Stat(m3u8Path); err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	return s, nil
}

func (m *Manager) HandleHTTP(w http.ResponseWriter, r *http.Request) {
	// Expected path /api/hls/{sessionID}/{filename}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/hls/"), "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}

	sessionID := parts[0]
	filename := parts[1]

	m.mu.Lock()
	session, ok := m.sessions[sessionID]
	m.mu.Unlock()

	if !ok {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.NotFound(w, r)
		return
	}

	session.access()

	filePath := filepath.Join(session.TempDir, filename)

	if !strings.HasPrefix(filepath.Clean(filePath), session.TempDir) {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}

	// Wait briefly if file isn't ready yet (especially segment files)
	for i := 0; i < 20; i++ {
		if _, err := os.Stat(filePath); err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if strings.HasSuffix(filename, ".m3u8") {
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	} else if strings.HasSuffix(filename, ".ts") {
		w.Header().Set("Content-Type", "video/MP2T")
	}

	http.ServeFile(w, r, filePath)
}
