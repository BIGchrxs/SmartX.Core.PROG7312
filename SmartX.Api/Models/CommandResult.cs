namespace SmartX.Api.Models;

/// <summary>
/// Outcome of an execute or undo call. Either Entry is set, or Error and StatusCode
/// describe why the command was refused.
/// </summary>
public sealed record CommandResult(CommandEntry? Entry, string? Error, int StatusCode)
{
    public bool Ok => Entry is not null;

    // Builds a successful result.
    public static CommandResult Success(CommandEntry entry) => new(entry, null, 200);
    //-----------//

    // Builds a refused result with a plain-text reason.
    public static CommandResult Fail(int statusCode, string error) => new(null, error, statusCode);
    //-----------//
}
