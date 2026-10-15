namespace SmartX.Api.Models;

/// <summary>One stored reading in a device's timeline. Bool readings are stored as 1 or 0.</summary>
public sealed record HistoryPoint(DateTime Timestamp, double Value, ReadingSeverity Severity);

/// <summary>A reading from any device, used by the live feed on the Command Stream page.</summary>
public sealed record RecentReading(
    string DeviceId,
    string Zone,
    DateTime Timestamp,
    double Value,
    ReadingSeverity Severity);
