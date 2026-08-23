// Registers Monaco completion/hover/signature-help providers for the
// "csharp" language, backed by the runner's Roslyn-powered endpoints.
// Providers are registered once and gated by `enabledRef` on every call —
// matching py-run's IntelliSense toggle (off by default) — rather than
// registered/unregistered as the toggle flips.
import * as monaco from "monaco-editor";
import { loadRunner, type CompletionItemInfo, type SourceFileInput } from "@/lib/runner";
import type { Session } from "@/lib/session";

interface IntelliSenseContext {
  getSession: () => Session;
  getLanguageVersion: () => string;
  getEnabled: () => boolean;
}

function activeFileNameFromModel(model: monaco.editor.ITextModel): string {
  const parts = model.uri.path.split("/");
  return parts[parts.length - 1];
}

function csharpFilesForRequest(session: Session, model: monaco.editor.ITextModel): SourceFileInput[] {
  const activeFile = activeFileNameFromModel(model);
  return session.files
    .filter((f) => f.language === "csharp")
    .map((f) => ({
      name: f.name,
      // The active model is the source of truth for its own file — session
      // state can lag a keystroke behind while React catches up.
      content: f.name === activeFile ? model.getValue() : f.content,
    }));
}

const KIND_MAP: Record<string, monaco.languages.CompletionItemKind> = {
  Method: monaco.languages.CompletionItemKind.Method,
  Property: monaco.languages.CompletionItemKind.Property,
  Field: monaco.languages.CompletionItemKind.Field,
  Variable: monaco.languages.CompletionItemKind.Variable,
  Module: monaco.languages.CompletionItemKind.Module,
  Enum: monaco.languages.CompletionItemKind.Enum,
  Interface: monaco.languages.CompletionItemKind.Interface,
  Struct: monaco.languages.CompletionItemKind.Struct,
  Class: monaco.languages.CompletionItemKind.Class,
};

function toCompletionItemKind(kind: string): monaco.languages.CompletionItemKind {
  return KIND_MAP[kind] ?? monaco.languages.CompletionItemKind.Text;
}

export function registerCSharpIntelliSense(ctx: IntelliSenseContext): () => void {
  const completion = monaco.languages.registerCompletionItemProvider("csharp", {
    triggerCharacters: ["."],
    async provideCompletionItems(model, position) {
      if (!ctx.getEnabled()) return { suggestions: [] };
      const runner = await loadRunner();
      const response = await runner.getCompletions({
        languageVersion: ctx.getLanguageVersion(),
        files: csharpFilesForRequest(ctx.getSession(), model),
        activeFile: activeFileNameFromModel(model),
        position: model.getOffsetAt(position),
      });

      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      return {
        suggestions: response.items.map(
          (item: CompletionItemInfo): monaco.languages.CompletionItem => ({
            label: item.label,
            kind: toCompletionItemKind(item.kind),
            detail: item.detail,
            insertText: item.label,
            range,
          }),
        ),
      };
    },
  });

  const hover = monaco.languages.registerHoverProvider("csharp", {
    async provideHover(model, position) {
      if (!ctx.getEnabled()) return null;
      const runner = await loadRunner();
      const response = await runner.getHover({
        languageVersion: ctx.getLanguageVersion(),
        files: csharpFilesForRequest(ctx.getSession(), model),
        activeFile: activeFileNameFromModel(model),
        position: model.getOffsetAt(position),
      });
      if (!response.text) return null;
      return { contents: [{ value: "```csharp\n" + response.text + "\n```" }] };
    },
  });

  const signatureHelp = monaco.languages.registerSignatureHelpProvider("csharp", {
    signatureHelpTriggerCharacters: ["(", ","],
    async provideSignatureHelp(model, position) {
      if (!ctx.getEnabled()) return null;
      const runner = await loadRunner();
      const response = await runner.getSignatureHelp({
        languageVersion: ctx.getLanguageVersion(),
        files: csharpFilesForRequest(ctx.getSession(), model),
        activeFile: activeFileNameFromModel(model),
        position: model.getOffsetAt(position),
      });
      if (response.signatures.length === 0) return null;
      return {
        value: {
          signatures: response.signatures.map((s) => ({
            label: s.label,
            parameters: s.parameters.map((p) => ({ label: p })),
          })),
          activeSignature: 0,
          activeParameter: response.activeParameter,
        },
        dispose() {},
      };
    },
  });

  return () => {
    completion.dispose();
    hover.dispose();
    signatureHelp.dispose();
  };
}
