using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace CsharpRun;

internal sealed record SourceFile(string Name, string Content);

internal sealed record RunRequest(string LanguageVersion, List<SourceFile> Files);

internal sealed record DiagnosticInfo(string Severity, string Message, string File, int Line, int Column);

internal sealed record OutputChunk(string Stream, string Text);

internal sealed record RunResponse(
    bool CompileSuccess,
    List<DiagnosticInfo> Diagnostics,
    List<OutputChunk> Output,
    string? RuntimeError);

/// <summary>
/// Compiles and runs a full C# program (not a REPL/script). Only one .cs file
/// in the set may contain top-level statements — that's a real C# language
/// rule (a compilation may have at most one entry-point-bearing tree), so a
/// second file with top-level statements surfaces as an ordinary compiler
/// diagnostic rather than something this runner special-cases.
/// </summary>
public static partial class CSharpRunner
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private static readonly HttpClient Http = new() { BaseAddress = new Uri(GetDocumentBaseUri()) };

    // Registered by the host page via setModuleImports('main.js', { getBaseUri: () => document.baseURI }).
    [JSImport("getBaseUri", "main.js")]
    private static partial string GetDocumentBaseUri();

    private static MetadataReference[]? _references;
    private static Task<MetadataReference[]>? _referencesTask;

    [JSExport]
    internal static async Task<string> Run(string requestJson)
    {
        RunResponse response;
        try
        {
            response = await RunCore(requestJson);
        }
        catch (Exception ex)
        {
            response = new RunResponse(false, new List<DiagnosticInfo>(), new List<OutputChunk>(), ex.ToString());
        }
        return JsonSerializer.Serialize(response, JsonOptions);
    }

    private static async Task<RunResponse> RunCore(string requestJson)
    {
        var request = JsonSerializer.Deserialize<RunRequest>(requestJson, JsonOptions)
            ?? throw new ArgumentException("Invalid request payload.");

        var references = await GetReferencesAsync();
        var languageVersion = ParseLanguageVersion(request.LanguageVersion);
        var parseOptions = new CSharpParseOptions(languageVersion);

        var csFiles = request.Files.Where(f => f.Name.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)).ToList();
        var trees = csFiles
            .Select(f => CSharpSyntaxTree.ParseText(f.Content, parseOptions, path: f.Name, encoding: System.Text.Encoding.UTF8))
            .ToList();
        // Matches `dotnet new console`'s <ImplicitUsings>enable</ImplicitUsings>
        // default so beginner-friendly programs don't need `using System;`.
        trees.Add(CSharpSyntaxTree.ParseText(ImplicitGlobalUsings, parseOptions, path: ImplicitUsingsPath));

        var compilation = CSharpCompilation.Create(
            "UserProgram",
            trees,
            references,
            new CSharpCompilationOptions(
                OutputKind.ConsoleApplication,
                concurrentBuild: false,
                optimizationLevel: OptimizationLevel.Debug));

        using var peStream = new MemoryStream();
        var emitResult = compilation.Emit(peStream);

        var diagnostics = emitResult.Diagnostics
            .Where(d => d.Severity >= DiagnosticSeverity.Warning && d.Location.GetLineSpan().Path != ImplicitUsingsPath)
            .Select(ToDiagnosticInfo)
            .ToList();

        if (!emitResult.Success)
        {
            return new RunResponse(false, diagnostics, new List<OutputChunk>(), null);
        }

        peStream.Position = 0;
        var assembly = Assembly.Load(peStream.ToArray());

        var output = new List<OutputChunk>();
        var originalOut = Console.Out;
        var originalErr = Console.Error;
        // Console.In's getter throws PlatformNotSupportedException in the
        // browser (there's no real stdin), so there's no "original" to save
        // here — SetIn is the only side of this pair that's usable.
        Console.SetOut(new CapturingWriter("stdout", output));
        Console.SetError(new CapturingWriter("stderr", output));
        Console.SetIn(new PromptingReader());

        string? runtimeError = null;
        try
        {
            var entry = assembly.EntryPoint
                ?? throw new InvalidOperationException(
                    "No entry point found — exactly one file must contain top-level statements or a Main method.");
            var parameters = entry.GetParameters().Length == 0 ? null : new object?[] { Array.Empty<string>() };
            var result = entry.Invoke(null, parameters);
            if (result is Task task)
            {
                await task;
            }
        }
        catch (TargetInvocationException ex) when (ex.InnerException is not null)
        {
            runtimeError = ex.InnerException.ToString();
        }
        catch (Exception ex)
        {
            runtimeError = ex.ToString();
        }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalErr);
        }

        return new RunResponse(true, diagnostics, output, runtimeError);
    }

    private static DiagnosticInfo ToDiagnosticInfo(Diagnostic d)
    {
        var span = d.Location.GetLineSpan();
        return new DiagnosticInfo(
            d.Severity.ToString(),
            d.GetMessage(),
            span.Path,
            span.StartLinePosition.Line + 1,
            span.StartLinePosition.Character + 1);
    }

    private const string ImplicitUsingsPath = "<implicit-usings>";

    private const string ImplicitGlobalUsings = """
        global using global::System;
        global using global::System.Collections.Generic;
        global using global::System.IO;
        global using global::System.Linq;
        global using global::System.Threading.Tasks;
        """;

    private static LanguageVersion ParseLanguageVersion(string? value) =>
        Enum.TryParse<LanguageVersion>(value, ignoreCase: true, out var parsed) ? parsed : LanguageVersion.Latest;

    // The reference-assembly tarball is fetched once and cached for the
    // lifetime of the runtime; concurrent Run calls share the same fetch.
    private static Task<MetadataReference[]> GetReferencesAsync()
    {
        if (_references is not null) return Task.FromResult(_references);
        return _referencesTask ??= LoadReferencesAsync();
    }

    private static async Task<MetadataReference[]> LoadReferencesAsync()
    {
        var zipBytes = await Http.GetByteArrayAsync("refs.zip");
        using var zipStream = new MemoryStream(zipBytes);
        using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);

        var refs = new List<MetadataReference>();
        foreach (var entry in archive.Entries)
        {
            if (!entry.Name.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)) continue;
            using var entryStream = entry.Open();
            using var ms = new MemoryStream();
            await entryStream.CopyToAsync(ms);
            refs.Add(MetadataReference.CreateFromImage(ms.ToArray()));
        }

        _references = refs.ToArray();
        return _references;
    }
}

internal sealed class CapturingWriter(string stream, List<OutputChunk> buffer) : TextWriter
{
    public override System.Text.Encoding Encoding => System.Text.Encoding.UTF8;

    public override void Write(char value) => buffer.Add(new OutputChunk(stream, value.ToString()));

    public override void Write(string? value)
    {
        if (!string.IsNullOrEmpty(value)) buffer.Add(new OutputChunk(stream, value));
    }
}

internal sealed partial class PromptingReader : TextReader
{
    public override string? ReadLine() => Prompt("");

    // Registered by the host page via setModuleImports('main.js', { prompt: ... }).
    // window.prompt() blocks synchronously, so this needs no async plumbing —
    // mirrors py-run's input() interception.
    [JSImport("prompt", "main.js")]
    private static partial string? Prompt(string message);
}
