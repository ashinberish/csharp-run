import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Shortcut } from "@/lib/session";
import { isModifierKey, shortcutFromEvent, shortcutLabel } from "@/lib/shortcut";

interface ShortcutRecorderProps {
  value: Shortcut;
  onChange: (shortcut: Shortcut) => void;
}

export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "min-w-24 rounded-md border border-input bg-transparent px-3 py-1.5 font-mono text-xs",
        recording ? "border-blue text-blue" : "text-foreground hover:bg-accent",
      )}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return;
        e.preventDefault();
        // Consume the keystroke entirely — otherwise it also bubbles to the
        // app's global shortcut listener, which (now already re-registered
        // with the shortcut this very keypress just set) immediately fires
        // the action being bound, right as it's recorded.
        e.stopPropagation();
        if (e.key === "Escape") {
          setRecording(false);
          return;
        }
        if (isModifierKey(e.key)) return;
        onChange(shortcutFromEvent(e.nativeEvent));
        setRecording(false);
      }}
    >
      {recording ? "Press keys…" : shortcutLabel(value)}
    </button>
  );
}
