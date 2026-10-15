namespace SmartX.Api.Models;

/// <summary>
/// One validated reading waiting in the ingestion queues. TelemetryPacket&lt;T&gt; is generic
/// over float, int and bool, so a single queue cannot hold them directly. This wrapper keeps
/// the original typed value plus a numeric form used by thresholds, history and trends.
/// </summary>
/// <param name="Priority">Higher means more urgent. Only used for Critical readings.</param>
public sealed record QueuedReading(
    string DeviceId,
    string Zone,
    SensorCategory Category,
    TelemetryValueType ValueType,
    object Value,
    double NumericValue,
    DateTime Timestamp,
    ReadingSeverity Severity,
    int Priority,
    string? Reason);
