import { useEffect, useMemo, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
import { TopBar } from "@/components/TopBar";
import { TabStrip } from "@/components/TabStrip";
import { EditorPane } from "@/components/EditorPane";
import { Divider } from "@/components/Divider";
import { ConsolePane, type OutputLine } from "@/components/ConsolePane";
import { StatusBar } from "@/components/StatusBar";
import { SettingsDialog } from "@/components/SettingsDialog";
import {
  MAIN_FILE,
  languageForName,
  loadLanguageVersion,
  loadSession,
  loadTheme,
  saveLanguageVersion,
  saveSession,
  saveTheme,
  type FileLanguage,
  type Session,
  type Theme,
} from "@/lib/session";
import { loadRunner, type RunResponse } from "@/lib/runner";

function activeFile(session: Session) {
  return session.files.find((f) => f.name === session.activeFile) ?? session.files[0];
}

function nextFileName(existing: string[], language: FileLanguage): string {
  const ext = language === "markdown" ? "md" : "cs";
  const base = language === "markdown" ? "notes" : "file";
  for (let i = 1; ; i++) {
    const name = i === 1 ? `${base}.${ext}` : `${base}${i}.${ext}`;
    if (!existing.includes(name)) return name;
  }
}

function App() {
  const [session, setSession] = useState<Session>(() => loadSession());
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());
  const [languageVersion, setLanguageVersionState] = useState(() => loadLanguageVersion());
  const [intellisenseEnabled, setIntellisenseEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [output, setOutput] = useState<OutputLine[]>([
    { stream: "system", text: "Booting C# runtime…\n" },
  ]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [editorFraction, setEditorFraction] = useState(0.6);

  const mainRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const active = useMemo(() => activeFile(session), [session]);

  // Persist session + theme + language version.
  useEffect(() => saveSession(session), [session]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "");
    saveTheme(theme);
  }, [theme]);
  useEffect(() => saveLanguageVersion(languageVersion), [languageVersion]);

  // Boot the WASM runner once.
  useEffect(() => {
    let cancelled = false;
    loadRunner().then(() => {
      if (cancelled) return;
      setRuntimeReady(true);
      setOutput((prev) => [...prev, { stream: "system", text: "Ready.\n" }]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateFileContent(name: string, content: string) {
    setSession((s) => ({
      ...s,
      files: s.files.map((f) => (f.name === name ? { ...f, content, dirty: true } : f)),
    }));
  }

  function selectFile(name: string) {
    setSession((s) => ({ ...s, activeFile: name }));
  }

  function closeFile(name: string) {
    if (name === MAIN_FILE) return;
    setSession((s) => {
      const files = s.files.filter((f) => f.name !== name);
      const activeFile = s.activeFile === name ? MAIN_FILE : s.activeFile;
      return { files, activeFile };
    });
  }

  function renameFile(oldName: string, newName: string) {
    if (oldName === MAIN_FILE || !newName) return;
    setSession((s) => {
      if (s.files.some((f) => f.name === newName)) return s;
      return {
        files: s.files.map((f) =>
          f.name === oldName ? { ...f, name: newName, language: languageForName(newName) } : f,
        ),
        activeFile: s.activeFile === oldName ? newName : s.activeFile,
      };
    });
  }

  function newFile(language: FileLanguage) {
    setSession((s) => {
      const name = nextFileName(
        s.files.map((f) => f.name),
        language,
      );
      return {
        files: [...s.files, { name, language, content: "", dirty: false }],
        activeFile: name,
      };
    });
  }

  function downloadActiveFile() {
    const blob = new Blob([active.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = active.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRun() {
    if (running || !runtimeReady) return;
    setRunning(true);

    const runFile = session.files.find((f) => f.name === active.name && f.language === "csharp")
      ? active
      : session.files.find((f) => f.name === MAIN_FILE)!;

    setOutput([{ stream: "system", text: `Running ${runFile.name}…\n` }]);

    try {
      const runner = await loadRunner();
      const response: RunResponse = await runner.run({
        languageVersion,
        files: session.files
          .filter((f) => f.language === "csharp")
          .map((f) => ({ name: f.name, content: f.content })),
      });
      renderResult(response);
    } catch (err) {
      setOutput((prev) => [...prev, { stream: "error", text: `${err}\n` }]);
    } finally {
      setRunning(false);
    }
  }

  function renderResult(response: RunResponse) {
    const lines: OutputLine[] = [];
    if (!response.compileSuccess) {
      lines.push({ stream: "error", text: "Compile errors:\n" });
      for (const d of response.diagnostics) {
        lines.push({ stream: "error", text: `${d.file}(${d.line},${d.column}): ${d.severity.toLowerCase()} ${d.message}\n` });
      }
      setOutput((prev) => [...prev, ...lines]);
      return;
    }

    for (const d of response.diagnostics) {
      lines.push({ stream: "system", text: `${d.file}(${d.line},${d.column}): warning ${d.message}\n` });
    }
    for (const chunk of response.output) {
      lines.push({ stream: chunk.stream, text: chunk.text });
    }
    if (response.runtimeError) {
      lines.push({ stream: "error", text: `${response.runtimeError}\n` });
    }
    lines.push({ stream: "system", text: "Program finished.\n" });
    setOutput((prev) => [...prev, ...lines]);
  }

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const runShortcut = (e.metaKey || e.ctrlKey) && e.key === "Enter";
      if (runShortcut) {
        e.preventDefault();
        void handleRun();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, runtimeReady, session, languageVersion]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar
        running={running}
        runtimeReady={runtimeReady}
        onRun={() => void handleRun()}
        onNewFile={newFile}
        onDownload={downloadActiveFile}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <TabStrip
        files={session.files}
        activeFile={session.activeFile}
        onSelect={selectFile}
        onClose={closeFile}
        onRename={renameFile}
      />

      <div ref={mainRef} className="flex min-h-0 flex-1">
        <div style={{ flexGrow: editorFraction, flexBasis: 0 }} className="flex min-w-50">
          <EditorPane
            path={active.name}
            language={active.language}
            value={active.content}
            theme={theme}
            onChange={(v) => updateFileContent(active.name, v)}
            onMount={(editorInstance) => {
              editorRef.current = editorInstance;
            }}
            onCursorChange={(line, column) => setCursor({ line, column })}
          />
        </div>
        <Divider containerRef={mainRef} onResize={setEditorFraction} />
        <div style={{ flexGrow: 1 - editorFraction, flexBasis: 0 }} className="flex min-w-55">
          <ConsolePane lines={output} onClear={() => setOutput([])} />
        </div>
      </div>

      <StatusBar
        statusText={!runtimeReady ? "Booting C# runtime…" : running ? "Running…" : "Ready"}
        busy={!runtimeReady || running}
        line={cursor.line}
        column={cursor.column}
        languageVersion={languageVersion}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        theme={theme}
        onThemeChange={setThemeState}
        languageVersion={languageVersion}
        onLanguageVersionChange={setLanguageVersionState}
        intellisenseEnabled={intellisenseEnabled}
        onIntellisenseChange={setIntellisenseEnabled}
      />
    </div>
  );
}

export default App;
