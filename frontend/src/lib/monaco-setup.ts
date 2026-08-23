// Configures @monaco-editor/react to use the locally bundled `monaco-editor`
// package instead of its default CDN loader (jsdelivr) — no external
// dependency for the editor itself, and it works offline. Neither the
// "csharp" nor "markdown" languages need a dedicated language-service
// worker (those exist only for json/css/html/typescript), so every worker
// label falls back to the plain editor worker.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

loader.config({ monaco });
