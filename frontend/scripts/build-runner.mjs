#!/usr/bin/env node
// Publishes runner/ (the .NET WASM Roslyn compiler service) and copies its
// output into frontend/public/runner/ so Vite serves it as static files.
// Not run automatically on install/dev — requires the .NET 8 SDK with the
// wasm-experimental workload (see the root README).
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(frontendDir);
const runnerDir = path.join(repoRoot, "runner");
const publishDir = path.join(runnerDir, "bin", "Release", "net8.0", "publish", "wwwroot");
const targetDir = path.join(frontendDir, "public", "runner");

console.log("Publishing runner/ (dotnet publish -c Release)...");
execSync("dotnet publish -c Release", { cwd: runnerDir, stdio: "inherit" });

if (!existsSync(path.join(publishDir, "_framework"))) {
  throw new Error(`Expected ${publishDir}/_framework to exist after publish.`);
}

console.log(`Copying published assets to ${targetDir}...`);
rmSync(targetDir, { recursive: true, force: true });
cpSync(path.join(publishDir, "_framework"), path.join(targetDir, "_framework"), { recursive: true });
cpSync(path.join(publishDir, "refs.zip"), path.join(targetDir, "refs.zip"));

console.log("Done.");
