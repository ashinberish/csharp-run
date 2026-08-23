export type FileLanguage = "csharp" | "markdown";

export interface SessionFile {
  name: string;
  language: FileLanguage;
  content: string;
  /** Set once on first edit; never cleared (mirrors py-run's "edited since creation" dot). */
  dirty: boolean;
}

export interface Session {
  files: SessionFile[];
  activeFile: string;
}

export const MAIN_FILE = "main.cs";

const STARTER_NOTES = `# Notes

Freeform space for anything — this file isn't compiled or run.
`;

const STARTER_MAIN = `Console.WriteLine("Hello, world!");
`;

export function createDefaultSession(): Session {
  return {
    files: [
      { name: MAIN_FILE, language: "csharp", content: STARTER_MAIN, dirty: false },
      { name: "notes.md", language: "markdown", content: STARTER_NOTES, dirty: false },
    ],
    activeFile: MAIN_FILE,
  };
}

export function languageForName(name: string): FileLanguage {
  return name.toLowerCase().endsWith(".md") ? "markdown" : "csharp";
}

const STORAGE_KEY = "csharp-run:session";

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSession();
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.files?.some((f) => f.name === MAIN_FILE)) return createDefaultSession();
    return parsed;
  } catch {
    return createDefaultSession();
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage can throw (private browsing, quota) — autosave is best-effort.
  }
}

const THEME_KEY = "csharp-run:theme";

export type Theme = "dark" | "light";

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // best-effort
  }
}

const LANGUAGE_VERSION_KEY = "csharp-run:languageVersion";

export const DEFAULT_LANGUAGE_VERSION = "Latest";

export function loadLanguageVersion(): string {
  try {
    return localStorage.getItem(LANGUAGE_VERSION_KEY) ?? DEFAULT_LANGUAGE_VERSION;
  } catch {
    return DEFAULT_LANGUAGE_VERSION;
  }
}

export function saveLanguageVersion(version: string): void {
  try {
    localStorage.setItem(LANGUAGE_VERSION_KEY, version);
  } catch {
    // best-effort
  }
}

export interface Shortcut {
  mod: boolean; // Ctrl on Windows/Linux, Cmd on Mac — treated as one interchangeable modifier
  shift: boolean;
  alt: boolean;
  key: string;
}

export const DEFAULT_FORMAT_SHORTCUT: Shortcut = { mod: true, shift: false, alt: false, key: "s" };

const FORMAT_SHORTCUT_KEY = "csharp-run:formatShortcut";

export function loadFormatShortcut(): Shortcut {
  try {
    const raw = localStorage.getItem(FORMAT_SHORTCUT_KEY);
    if (!raw) return DEFAULT_FORMAT_SHORTCUT;
    const parsed = JSON.parse(raw) as Partial<Shortcut>;
    if (typeof parsed.key !== "string") return DEFAULT_FORMAT_SHORTCUT;
    return { mod: !!parsed.mod, shift: !!parsed.shift, alt: !!parsed.alt, key: parsed.key };
  } catch {
    return DEFAULT_FORMAT_SHORTCUT;
  }
}

export function saveFormatShortcut(shortcut: Shortcut): void {
  try {
    localStorage.setItem(FORMAT_SHORTCUT_KEY, JSON.stringify(shortcut));
  } catch {
    // best-effort
  }
}
