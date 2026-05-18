import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

export interface HLSViewerProps {
  fileUrl: string;
  autoPlay?: boolean;
  loop?: boolean;
}

export default function HLSViewer({
  fileUrl,
  autoPlay = true,
  loop = true,
}: HLSViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Try to speed up startup with lower latency config if needed
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Network error encountered while loading video.");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Media error encountered. Trying to recover.");
              hls.recoverMediaError();
              break;
            default:
              setError("Fatal error encountered playing video.");
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(fileUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch((e) => console.error("Autoplay prevented:", e));
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari support
      video.src = fileUrl;
      video.addEventListener("loadedmetadata", () => {
        if (autoPlay) {
          video.play().catch((e) => console.error("Autoplay prevented:", e));
        }
      });
      return () => {
        video.src = "";
      };
    } else {
      setError("HLS is not supported in this browser.");
      return () => {};
    }
  }, [fileUrl, autoPlay]);

  return (
    <div
      className="file-viewer-container"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <video
        ref={videoRef}
        controls
        loop={loop}
        crossOrigin="anonymous"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
      {error && (
        <div
          className="viewer-overlay"
          style={{
            position: "absolute",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
