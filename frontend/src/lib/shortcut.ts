import type { Shortcut } from "@/lib/session";

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Modifier-only keypresses (still recording) have no real key to bind yet. */
const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt", "AltGraph", "OS"]);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

export function shortcutFromEvent(e: KeyboardEvent): Shortcut {
  return {
    mod: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
  };
}

export function matchesShortcut(e: KeyboardEvent, shortcut: Shortcut): boolean {
  const modPressed = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return modPressed === shortcut.mod && e.shiftKey === shortcut.shift && e.altKey === shortcut.alt && key === shortcut.key;
}

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

export function shortcutLabel(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (shortcut.alt) parts.push(isMac ? "⌥" : "Alt");
  if (shortcut.shift) parts.push(isMac ? "⇧" : "Shift");
  const keyLower = shortcut.key.toLowerCase();
  const keyLabel = KEY_LABELS[keyLower] ?? (shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  parts.push(keyLabel);
  return parts.join(isMac ? "" : "+");
}
