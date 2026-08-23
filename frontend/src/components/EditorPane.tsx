import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { FileLanguage, Theme } from "@/lib/session";

interface EditorPaneProps {
  path: string;
  language: FileLanguage;
  value: string;
  theme: Theme;
  onChange: (value: string) => void;
  onMount: OnMount;
  onCursorChange: (line: number, column: number) => void;
}

export function EditorPane({ path, language, value, theme, onChange, onMount, onCursorChange }: EditorPaneProps) {
  function handleMount(editorInstance: editor.IStandaloneCodeEditor, monaco: Parameters<OnMount>[1]) {
    editorInstance.onDidChangeCursorPosition((e) => {
      onCursorChange(e.position.lineNumber, e.position.column);
    });
    onMount(editorInstance, monaco);
  }

  return (
    <div className="relative min-w-50 flex-1 basis-3/5">
      <Editor
        path={path}
        language={language === "markdown" ? "markdown" : "csharp"}
        value={value}
        theme={theme === "light" ? "vs" : "vs-dark"}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          fontSize: 13,
          minimap: { enabled: false },
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
