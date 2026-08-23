import { dotnet } from './_framework/dotnet.js'

const { setModuleImports, getAssemblyExports, getConfig } = await dotnet
  .withDiagnosticTracing(false)
  .create();

setModuleImports('main.js', {
  prompt: (message) => window.prompt(message),
  getBaseUri: () => document.baseURI,
});

const config = getConfig();
const exports = await getAssemblyExports(config.mainAssemblyName);

/** @param {{ languageVersion: string, files: { name: string, content: string }[] }} request */
window.__runCSharp = (request) => exports.CsharpRun.CSharpRunner.Run(JSON.stringify(request));

const resultJson = await window.__runCSharp({
  languageVersion: 'Latest',
  files: [
    {
      name: 'main.cs',
      content: [
        'int Add(int a, int b) => a + b;',
        'Console.WriteLine($"3 + 4 = {Add(3, 4)}");',
        'Console.WriteLine("Sum via Linq: " + new[] {1,2,3,4,5}.Sum());',
      ].join('\n'),
    },
  ],
});
document.getElementById('out').textContent = JSON.stringify(JSON.parse(resultJson), null, 2);
console.log(resultJson);

await dotnet.run();
