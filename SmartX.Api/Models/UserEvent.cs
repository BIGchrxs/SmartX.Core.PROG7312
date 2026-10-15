namespace SmartX.Api.Models;

/// <summary>
/// One thing the operator did: a search or a command. ActiveConditions lists the alerts
/// that were active at that moment, which is what the pattern engine learns from.
/// </summary>
/// <param name="Kind">"search" or "command".</param>
/// <param name="Subject">The search term, or the device ID for a command.</param>
/// <param name="Detail">"ON" or "OFF" for a command, otherwise null.</param>
/// <param name="Source">"user" for live activity, "demo" for seeded history.</param>
public sealed record UserEvent(
    DateTime Timestamp,
    string Kind,
    string Subject,
    string? Detail,
    IReadOnlyList<string> ActiveConditions,
    string Source);

/// <summary>
/// A learned habit: when Condition was active, the operator did Action. Confidence is
/// Count divided by the number of times the condition has occurred.
/// </summary>
public sealed record HabitPattern(
    string Condition,
    string Action,
    int Count,
    int Incidents,
    double Confidence);
