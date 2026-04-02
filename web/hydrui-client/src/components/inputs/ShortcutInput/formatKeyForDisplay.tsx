/**
 * Format a key string for display.
 * Converts special key names to a more user-friendly format.
 */
export default function formatKeyForDisplay(key: string): string {
  if (!key) return "";

  // Map of special key names to display names
  const keyDisplayMap: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    " ": "Space",
    Escape: "Esc",
    Enter: "↵",
    Tab: "⇥",
    Backspace: "⌫",
    Delete: "Del",
    Insert: "Ins",
    Home: "Home",
    End: "End",
    PageUp: "PgUp",
    PageDown: "PgDn",
  };

  return keyDisplayMap[key] || key.toUpperCase();
}
