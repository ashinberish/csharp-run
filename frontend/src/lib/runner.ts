// Loads and wraps the runner/ WASM module (published to public/runner/ by
// `npm run build:runner`). This is the same dotnet.js host API used by the
// runner's own standalone test harness (runner/wwwroot/main.js).

export interface SourceFileInput {
  name: string;
  content: string;
}

export interface RunRequest {
  languageVersion: string;
  files: SourceFileInput[];
}

export type OutputStream = "stdout" | "stderr";

export interface OutputChunk {
  stream: OutputStream;
  text: string;
}

export interface DiagnosticInfo {
  severity: "Error" | "Warning";
  message: string;
  file: string;
  line: number;
  column: number;
}

export interface RunResponse {
  compileSuccess: boolean;
  diagnostics: DiagnosticInfo[];
  output: OutputChunk[];
  runtimeError?: string;
}

export interface IntelliSenseRequest {
  languageVersion: string;
  files: SourceFileInput[];
  activeFile: string;
  position: number;
}

export interface CompletionItemInfo {
  label: string;
  kind: string;
  detail?: string;
}

export interface CompletionResponse {
  items: CompletionItemInfo[];
}

export interface HoverResponse {
  text?: string;
}

export interface SignatureInfo {
  label: string;
  parameters: string[];
}

export interface SignatureHelpResponse {
  signatures: SignatureInfo[];
  activeParameter: number;
}

export interface FormatRequest {
  languageVersion: string;
  content: string;
}

export interface FormatResponse {
  success: boolean;
  formattedContent?: string;
  error?: string;
}

interface CSharpRunnerExports {
  CsharpRun: {
    CSharpRunner: {
      Run(requestJson: string): Promise<string>;
    };
    CSharpIntelliSense: {
      GetCompletions(requestJson: string): Promise<string>;
      GetHover(requestJson: string): Promise<string>;
      GetSignatureHelp(requestJson: string): Promise<string>;
    };
    CSharpFormatter: {
      Format(requestJson: string): string;
    };
  };
}

export interface Runner {
  run(request: RunRequest): Promise<RunResponse>;
  getCompletions(request: IntelliSenseRequest): Promise<CompletionResponse>;
  getHover(request: IntelliSenseRequest): Promise<HoverResponse>;
  getSignatureHelp(request: IntelliSenseRequest): Promise<SignatureHelpResponse>;
  format(request: FormatRequest): Promise<FormatResponse>;
}

declare global {
  interface Window {
    __csharpRunnerExports?: CSharpRunnerExports;
  }
}

let runnerPromise: Promise<Runner> | null = null;

/** Idempotent — safe to call from multiple places; the WASM module boots once. */
export function loadRunner(): Promise<Runner> {
  if (!runnerPromise) runnerPromise = initRunner();
  return runnerPromise;
}

// /runner/_framework/dotnet.js is served from Vite's public/ directory, which
// Vite deliberately refuses to serve through a JS import() (it's copied
// as-is at build time, "should not be imported from source code" — Vite's
// own error message). A real <script type="module"> tag sidesteps this: the
// browser loads it natively, outside Vite's module graph entirely.
function initRunner(): Promise<Runner> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import { dotnet } from '/runner/_framework/dotnet.js';
      try {
        const { setModuleImports, getAssemblyExports, getConfig } = await dotnet.withDiagnosticTracing(false).create();
        setModuleImports('main.js', {
          prompt: (message) => window.prompt(message),
          // NOT document.baseURI: the runner's assets (and refs.zip) live
          // under /runner/, a subpath of the app's own page URL, so the
          // runner's relative HttpClient fetches need that as their base.
          getBaseUri: () => new URL('/runner/', window.location.origin).href,
        });
        const config = getConfig();
        window.__csharpRunnerExports = await getAssemblyExports(config.mainAssemblyName);
        void dotnet.run();
        window.dispatchEvent(new CustomEvent('csharp-runner-ready'));
      } catch (err) {
        window.dispatchEvent(new CustomEvent('csharp-runner-error', { detail: String(err) }));
      }
    `;
    window.addEventListener("csharp-runner-ready", () => resolve(makeRunner()), { once: true });
    window.addEventListener(
      "csharp-runner-error",
      (e) => reject(new Error((e as CustomEvent<string>).detail)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

function getExports(): CSharpRunnerExports {
  const exports = window.__csharpRunnerExports;
  if (!exports) throw new Error("Runner not initialized.");
  return exports;
}

function makeRunner(): Runner {
  return {
    async run(request: RunRequest) {
      const json = await getExports().CsharpRun.CSharpRunner.Run(JSON.stringify(request));
      return JSON.parse(json) as RunResponse;
    },
    async getCompletions(request: IntelliSenseRequest) {
      const json = await getExports().CsharpRun.CSharpIntelliSense.GetCompletions(JSON.stringify(request));
      return JSON.parse(json) as CompletionResponse;
    },
    async getHover(request: IntelliSenseRequest) {
      const json = await getExports().CsharpRun.CSharpIntelliSense.GetHover(JSON.stringify(request));
      return JSON.parse(json) as HoverResponse;
    },
    async getSignatureHelp(request: IntelliSenseRequest) {
      const json = await getExports().CsharpRun.CSharpIntelliSense.GetSignatureHelp(JSON.stringify(request));
      return JSON.parse(json) as SignatureHelpResponse;
    },
    async format(request: FormatRequest) {
      const json = getExports().CsharpRun.CSharpFormatter.Format(JSON.stringify(request));
      return JSON.parse(json) as FormatResponse;
    },
  };
}
