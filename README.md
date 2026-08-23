# csharp//run

A full C# environment running entirely in your browser tab — no server, no signup, no
install. Powered by [Roslyn](https://github.com/dotnet/roslyn) and the
[.NET WebAssembly runtime](https://learn.microsoft.com/dotnet/core/deploying/wasm-browser-apps/)
(compiling and running arbitrary C# in-process, in-browser) and the
[Monaco Editor](https://microsoft.github.io/monaco-editor/) (the editor behind VS Code).

This is the C# counterpart to [py//run](https://github.com/ashinberish/py-run) — same idea,
same UI/theme, different language and runtime underneath.

Everything executes client-side. Your code never leaves the browser.

## Features

- **Run C# in the browser** — press Run (or `Ctrl`/`Cmd`+`Enter`) to compile and execute via
  Roslyn. `Console.ReadLine()` is intercepted with a browser prompt.
- **Multiple files per session** — `+ New` creates a `.cs` file by default; its dropdown also
  offers a Markdown file for freeform notes. `main.cs` always exists and can't be closed or
  renamed. Other `.cs` files in the session are compiled alongside the active file as ordinary
  classes — only one file may contain top-level statements, a real C# constraint the compiler
  itself enforces.
- **Selectable C# language version** — C# 10 through Preview, from Settings. Unlike py-run's
  Python version picker this is a compiler flag, not a different runtime — no reload needed.
- **Dark / light theme**, synced with Monaco's own editor theme.
- **Auto-saved session** — every file's content, plus which one was open, is saved to
  `localStorage` as you type and restored the next time you open the app.
- **Download** — export the currently open file under its own name.

## Project layout

```
runner/     .NET WASM project: compiles + runs arbitrary C# via Roslyn, exposed to JS via
            [JSExport]. Not a Blazor app — the "WebAssembly Browser App" template plus Roslyn.
frontend/   Vite + React + TypeScript + Tailwind + shadcn UI, themed to match py-run.
```

`runner/` is a genuinely separate build (it needs the .NET SDK); `frontend/` consumes its
published output as static files.

## Getting started

Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) with the
`wasm-experimental` workload, and Node.js.

```bash
dotnet workload install wasm-experimental

cd frontend
npm install
npm run build:runner   # publishes runner/ and copies it into frontend/public/runner/
npm run dev
```

Then open the printed local URL.

```bash
npm run build     # production build into dist/ (run `build:runner` first)
npm run preview   # serve the production build locally
```

Re-run `npm run build:runner` any time `runner/` changes — the frontend doesn't rebuild it
automatically.

## How it works

- `runner/CSharpRunner.cs` is the whole compiler service: parses each open `.cs` file into a
  `SyntaxTree`, compiles them together with `CSharpCompilation`, emits to an in-memory assembly,
  and invokes its entry point via reflection. It deliberately does **not** use Roslyn's
  `CSharpScript` API — that hard-references `typeof(object).Assembly` via reflection internally,
  and assemblies loaded in the browser have no `.Location`, so it throws
  `NotSupportedException` under Mono WASM. Compiling a full program and loading it via
  `Assembly.Load` sidesteps that entirely, and maps naturally onto py-run's "run a file, which
  can reference other files" model.
- The full .NET reference-assembly set is staged as a zip at build time (from the local SDK's
  `Microsoft.NETCore.App.Ref` pack, not committed to git) and fetched once at runtime — this app
  compiles arbitrary user code, so trimming is disabled and every reference assembly needs to be
  available, not just the ones a static analysis can see being used.
- `frontend/src/lib/runner.ts` boots the published WASM module by injecting a real
  `<script type="module">` tag rather than a JS `import()` — Vite's `public/` directory
  explicitly refuses to serve files through `import()` ("should not be imported from source
  code... can only be referenced via HTML tags"), which is exactly how the runner's assets are
  served.
- `frontend/src/lib/monaco-setup.ts` configures Monaco to load from the bundled npm package
  instead of a CDN.
- `frontend/src/lib/session.ts` owns the multi-file session model and `localStorage`
  persistence.

## License

MIT
