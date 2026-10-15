namespace SmartX.Api.Models;

/// <summary>A command the dashboard can run in one click when the operator accepts a suggestion.</summary>
public sealed record SuggestedCommand(string DeviceId, bool On);

/// <summary>
/// One entry in the Automated Insights feed. Type is "Alert", "Trend", "Habit" or "Frequent".
/// Command and Search are optional one-click actions. Rank decides the order, highest first.
/// </summary>
public sealed record Insight(
    string Id,
    string Type,
    string Title,
    string Message,
    string Reason,
    double Confidence,
    string? DeviceId,
    SuggestedCommand? Command,
    string? Search,
    int Rank);
