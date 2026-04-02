import { useCallback, useEffect, useRef, useState } from "react";

import formatKeyForDisplay from "./formatKeyForDisplay";
import "./index.css";

interface ShortcutInputProps {
  value: string;
  onChange: (key: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A reusable input component for capturing keyboard shortcuts.
 *
 * When clicked/focused, it enters "recording" mode and listens for keydown events.
 * - Pressing a key captures it as the new shortcut
 * - Escape cancels the recording without changing the shortcut
 * - Backspace/Delete clears the shortcut
 */
function ShortcutInput({
  value,
  onChange,
  placeholder = "Press a key...",
  disabled = false,
}: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();

      // Escape cancels the recording
      if (e.key === "Escape") {
        setIsRecording(false);
        inputRef.current?.blur();
        return;
      }

      // Backspace/Delete clears the shortcut
      if (e.key === "Backspace" || e.key === "Delete") {
        onChange("");
        setIsRecording(false);
        inputRef.current?.blur();
        return;
      }

      // Ignore modifier keys by themselves
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        return;
      }

      // Capture the key
      // For now, we only support single keys (no modifiers)
      // The key property gives us the character for letter/number keys
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      onChange(key);
      setIsRecording(false);
      inputRef.current?.blur();
    },
    [isRecording, onChange],
  );

  useEffect(() => {
    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRecording, handleKeyDown]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      setIsRecording(true);
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleBlur = useCallback(() => {
    setIsRecording(false);
  }, []);

  const displayValue = formatKeyForDisplay(value);

  return (
    <button
      ref={inputRef}
      type="button"
      className={`shortcut-input ${isRecording ? "shortcut-input-recording" : ""} ${disabled ? "shortcut-input-disabled" : ""}`}
      onClick={handleClick}
      onBlur={handleBlur}
      disabled={disabled}
      aria-label={`Keyboard shortcut: ${displayValue || "none"}. Click to change.`}
    >
      {isRecording ? (
        <span className="shortcut-input-recording-text">Press a key...</span>
      ) : displayValue ? (
        <kbd className="shortcut-input-key">{displayValue}</kbd>
      ) : (
        <span className="shortcut-input-placeholder">{placeholder}</span>
      )}
    </button>
  );
}

export default ShortcutInput;
