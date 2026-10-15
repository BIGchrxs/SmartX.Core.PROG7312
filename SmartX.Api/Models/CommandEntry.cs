namespace SmartX.Api.Models;

/// <summary>
/// One manual override command. These are pushed onto a Stack so the operator
/// can undo the most recent command first.
/// </summary>
public sealed record CommandEntry(
    long Id,
    string DeviceId,
    bool NewState,
    bool PreviousState,
    DateTime Timestamp,
    string Source);

/// <summary>Request body for POST /commands. Source is "operator" unless a suggestion was applied.</summary>
public sealed record CommandRequest(string DeviceId, bool On, string? Source);
