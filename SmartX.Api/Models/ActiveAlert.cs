namespace SmartX.Api.Models;

/// <summary>An alert that is currently active. The key is "deviceId:Type".</summary>
public sealed record ActiveAlert(
    string Key,
    string DeviceId,
    AlertType Type,
    string Message,
    DateTime RaisedAt);

/// <summary>One entry in the alert log. Kind is either "Raised" or "Recovered".</summary>
public sealed record AlertEvent(
    DateTime Timestamp,
    string Key,
    string Kind,
    string Message);
