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
window.__getCompletions = (request) => exports.CsharpRun.CSharpIntelliSense.GetCompletions(JSON.stringify(request));
window.__getHover = (request) => exports.CsharpRun.CSharpIntelliSense.GetHover(JSON.stringify(request));
window.__getSignatureHelp = (request) => exports.CsharpRun.CSharpIntelliSense.GetSignatureHelp(JSON.stringify(request));

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

// Multi-file IntelliSense test: main.cs references a class from helper.cs.
const mainCs = [
  'var greeter = new Helper();',
  'var s = greeter.',
].join('\n');
const helperCs = [
  'class Helper',
  '{',
  '    public string SayHi(string name) => $"Hi, {name}!";',
  '    public int Add(int a, int b) => a + b;',
  '}',
].join('\n');
const isFiles = [
  { name: 'main.cs', content: mainCs },
  { name: 'helper.cs', content: helperCs },
];
const completionPos = mainCs.length; // right after "greeter."

document.getElementById('completionBtn').addEventListener('click', async () => {
  const json = await window.__getCompletions({ languageVersion: 'Latest', files: isFiles, activeFile: 'main.cs', position: completionPos });
  document.getElementById('completionOut').textContent = json;
  console.log('COMPLETIONS:', json);
});

const hoverCode = 'var greeter = new Helper();\nConsole.WriteLine(greeter.SayHi("World"));';
const hoverPos = hoverCode.indexOf('SayHi') + 2;

document.getElementById('hoverBtn').addEventListener('click', async () => {
  const json = await window.__getHover({
    languageVersion: 'Latest',
    files: [{ name: 'main.cs', content: hoverCode }, { name: 'helper.cs', content: helperCs }],
    activeFile: 'main.cs',
    position: hoverPos,
  });
  document.getElementById('hoverOut').textContent = json;
  console.log('HOVER:', json);
});

const sigHelpPrefix = 'var greeter = new Helper();\ngreeter.Add(1, ';
const sigHelpCode = sigHelpPrefix + ');';
const sigHelpPos = sigHelpPrefix.length;

document.getElementById('sigHelpBtn').addEventListener('click', async () => {
  const json = await window.__getSignatureHelp({
    languageVersion: 'Latest',
    files: [{ name: 'main.cs', content: sigHelpCode }, { name: 'helper.cs', content: helperCs }],
    activeFile: 'main.cs',
    position: sigHelpPos,
  });
  document.getElementById('sigHelpOut').textContent = json;
  console.log('SIGHELP:', json);
});

await dotnet.run();
