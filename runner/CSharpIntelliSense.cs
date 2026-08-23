using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CsharpRun;

internal sealed record IntelliSenseRequest(string LanguageVersion, List<SourceFile> Files, string ActiveFile, int Position);

internal sealed record CompletionItemInfo(string Label, string Kind, string? Detail);
internal sealed record CompletionResponse(List<CompletionItemInfo> Items);

internal sealed record HoverResponse(string? Text);

internal sealed record SignatureInfo(string Label, List<string> Parameters);
internal sealed record SignatureHelpResponse(List<SignatureInfo> Signatures, int ActiveParameter);

/// <summary>
/// Completion/hover/signature-help built directly on Roslyn's compiler API
/// (SyntaxTree + SemanticModel + SemanticModel.LookupSymbols) rather than
/// Microsoft.CodeAnalysis.Features' CompletionService/QuickInfoService —
/// those need an AdhocWorkspace with MEF-composed providers, and a single
/// GetCompletionsAsync call through that stack measured in the multiple
/// *minutes* under the Mono WASM interpreter (and enabling WASM AOT to
/// speed it up didn't even finish publishing in 10). LookupSymbols is the
/// same primitive a full completion engine is built on, just without the
/// fuzzy matching, snippets, and import suggestions — real, accurate,
/// scope-aware completion in well under a second.
/// </summary>
public static partial class CSharpIntelliSense
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [JSExport]
    internal static async Task<string> GetCompletions(string requestJson)
    {
        try
        {
            var (semanticModel, tree, position) = await PrepareAsync(requestJson);
            var root = await tree.GetRootAsync();

            var items = new List<CompletionItemInfo>();
            var (isMemberAccess, target) = FindMemberAccessTarget(root, position);

            IEnumerable<ISymbol> symbols;
            if (isMemberAccess && target is not null)
            {
                var type = semanticModel.GetTypeInfo(target).Type;
                symbols = type is null
                    ? []
                    : semanticModel.LookupSymbols(position, type, includeReducedExtensionMethods: true);
            }
            else
            {
                symbols = semanticModel.LookupSymbols(position);
            }

            items.AddRange(symbols
                .Where(s => !s.IsImplicitlyDeclared && !s.Name.StartsWith('.') && s.Name.Length > 0)
                .GroupBy(s => s.Name)
                .Select(g => g.First())
                .OrderBy(s => s.Name, StringComparer.Ordinal)
                .Take(200)
                .Select(s => new CompletionItemInfo(s.Name, KindOf(s), s.ToMinimalDisplayString(semanticModel, position))));

            return JsonSerializer.Serialize(new CompletionResponse(items), JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new CompletionResponse([new CompletionItemInfo("", "Error", ex.Message)]), JsonOptions);
        }
    }

    [JSExport]
    internal static async Task<string> GetHover(string requestJson)
    {
        try
        {
            var (semanticModel, tree, position) = await PrepareAsync(requestJson);
            var root = await tree.GetRootAsync();
            var token = root.FindToken(position);
            var node = token.Parent;

            ISymbol? symbol = null;
            if (node is not null)
            {
                symbol = semanticModel.GetSymbolInfo(node).Symbol
                    ?? semanticModel.GetDeclaredSymbol(node)
                    ?? (node.Parent is not null ? semanticModel.GetSymbolInfo(node.Parent).Symbol : null);
            }

            var text = symbol is null ? null : FormatHover(symbol);
            return JsonSerializer.Serialize(new HoverResponse(text), JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new HoverResponse(ex.Message), JsonOptions);
        }
    }

    [JSExport]
    internal static async Task<string> GetSignatureHelp(string requestJson)
    {
        try
        {
            var (semanticModel, tree, position) = await PrepareAsync(requestJson);
            var root = await tree.GetRootAsync();
            var token = root.FindToken(position);

            for (var n = token.Parent; n is not null; n = n.Parent)
            {
                // GetMemberGroup wants the invoked *expression* (`greeter.Add`) for a
                // call, but the object-creation node itself (not a sub-expression) for
                // `new Foo(...)` — they're different shapes of the same "what are the
                // candidate overloads here" question.
                (ArgumentListSyntax ArgList, ExpressionSyntax ForMemberGroup)? target = n switch
                {
                    InvocationExpressionSyntax inv => (inv.ArgumentList, inv.Expression),
                    ObjectCreationExpressionSyntax { ArgumentList: not null } oc => (oc.ArgumentList, oc),
                    _ => null,
                };
                if (target is not { } t || position < t.ArgList.Span.Start || position > t.ArgList.Span.End) continue;
                var argList = t.ArgList;

                var candidates = semanticModel.GetMemberGroup(t.ForMemberGroup);
                if (candidates.Length == 0) continue;

                var activeParameter = 0;
                foreach (var arg in argList.Arguments)
                {
                    if (position <= arg.Span.End) break;
                    activeParameter++;
                }

                var signatures = candidates
                    .OfType<IMethodSymbol>()
                    .Select(m => new SignatureInfo(
                        m.ToMinimalDisplayString(semanticModel, position),
                        m.Parameters.Select(p => p.ToDisplayString()).ToList()))
                    .ToList();

                return JsonSerializer.Serialize(new SignatureHelpResponse(signatures, activeParameter), JsonOptions);
            }

            return JsonSerializer.Serialize(new SignatureHelpResponse([], 0), JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new SignatureHelpResponse([new SignatureInfo(ex.Message, [])], 0), JsonOptions);
        }
    }


    private static async Task<(SemanticModel Model, SyntaxTree Tree, int Position)> PrepareAsync(string requestJson)
    {
        var request = JsonSerializer.Deserialize<IntelliSenseRequest>(requestJson, JsonOptions)
            ?? throw new ArgumentException("Invalid request payload.");

        var references = await CSharpRunner.GetReferencesAsync();
        var compilation = CSharpRunner.BuildCompilation(request.Files, request.LanguageVersion, references, out var treesByFile);

        if (!treesByFile.TryGetValue(request.ActiveFile, out var tree))
            throw new ArgumentException($"Unknown file '{request.ActiveFile}'.");

        var position = Math.Clamp(request.Position, 0, tree.GetText().Length);
        return (compilation.GetSemanticModel(tree), tree, position);
    }

    /// <summary>
    /// Right after `expr.` or partway through `expr.partialName`. Only
    /// looks within the current statement — good enough for the common
    /// case without walking arbitrarily far up the tree.
    /// </summary>
    private static (bool IsMemberAccess, ExpressionSyntax? Target) FindMemberAccessTarget(SyntaxNode root, int position)
    {
        var token = root.FindToken(Math.Max(0, position - 1));
        for (var n = token.Parent; n is not null; n = n.Parent)
        {
            if (n is MemberAccessExpressionSyntax maes && maes.Expression.Span.End <= position && position <= maes.Span.End)
                return (true, maes.Expression);
            if (n is StatementSyntax) break;
        }
        return (false, null);
    }

    private static string KindOf(ISymbol symbol) => symbol switch
    {
        IMethodSymbol => "Method",
        IPropertySymbol => "Property",
        IFieldSymbol => "Field",
        ILocalSymbol => "Variable",
        IParameterSymbol => "Variable",
        INamespaceSymbol => "Module",
        ITypeSymbol { TypeKind: TypeKind.Enum } => "Enum",
        ITypeSymbol { TypeKind: TypeKind.Interface } => "Interface",
        ITypeSymbol { TypeKind: TypeKind.Struct } => "Struct",
        ITypeSymbol => "Class",
        _ => "Text",
    };

    private static readonly SymbolDisplayFormat HoverFormat = new(
        globalNamespaceStyle: SymbolDisplayGlobalNamespaceStyle.Omitted,
        typeQualificationStyle: SymbolDisplayTypeQualificationStyle.NameAndContainingTypesAndNamespaces,
        genericsOptions: SymbolDisplayGenericsOptions.IncludeTypeParameters,
        memberOptions: SymbolDisplayMemberOptions.IncludeParameters | SymbolDisplayMemberOptions.IncludeType |
                       SymbolDisplayMemberOptions.IncludeContainingType | SymbolDisplayMemberOptions.IncludeAccessibility,
        parameterOptions: SymbolDisplayParameterOptions.IncludeType | SymbolDisplayParameterOptions.IncludeName,
        propertyStyle: SymbolDisplayPropertyStyle.ShowReadWriteDescriptor,
        miscellaneousOptions: SymbolDisplayMiscellaneousOptions.UseSpecialTypes);

    private static string FormatHover(ISymbol symbol)
    {
        var signature = symbol.ToDisplayString(HoverFormat);
        var doc = symbol.GetDocumentationCommentXml();
        return string.IsNullOrWhiteSpace(doc) ? signature : $"{signature}\n\n{SummaryFromXmlDoc(doc)}";
    }

    private static string SummaryFromXmlDoc(string xml)
    {
        try
        {
            var doc = System.Xml.Linq.XDocument.Parse(xml);
            var summary = doc.Descendants("summary").FirstOrDefault()?.Value.Trim();
            return summary ?? "";
        }
        catch
        {
            return "";
        }
    }
}
