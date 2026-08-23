using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Formatting;

namespace CsharpRun;

internal sealed record FormatRequest(string LanguageVersion, string Content);

internal sealed record FormatResponse(bool Success, string? FormattedContent, string? Error);

/// <summary>
/// Purely syntactic — Formatter.Format works on a bare SyntaxTree with no
/// compilation/references/semantic model involved, so (unlike completion)
/// there's no reason to expect it to be slow. Measured ~800ms cold (~400ms
/// of that is one-time AdhocWorkspace construction, cached below) and
/// comfortably sub-100ms warm.
/// </summary>
public static partial class CSharpFormatter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Lazy<AdhocWorkspace> Workspace = new(() => new AdhocWorkspace());

    [JSExport]
    internal static string Format(string requestJson)
    {
        try
        {
            var request = JsonSerializer.Deserialize<FormatRequest>(requestJson, JsonOptions)
                ?? throw new ArgumentException("Invalid request payload.");

            var languageVersion = Enum.TryParse<LanguageVersion>(request.LanguageVersion, ignoreCase: true, out var parsed)
                ? parsed
                : LanguageVersion.Latest;

            var tree = CSharpSyntaxTree.ParseText(request.Content, new CSharpParseOptions(languageVersion));
            var formattedRoot = Formatter.Format(tree.GetRoot(), Workspace.Value);

            return JsonSerializer.Serialize(new FormatResponse(true, formattedRoot.ToFullString(), null), JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new FormatResponse(false, null, ex.Message), JsonOptions);
        }
    }
}
