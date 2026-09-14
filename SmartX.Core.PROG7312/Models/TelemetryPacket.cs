namespace SmartX.Api.Models;


public class TelemetryPacket<T>
{
    public string DeviceId { get; }
    public string Zone { get; }
    public SensorCategory Category { get; }
    public T Value { get; }
    public DateTime Timestamp { get; }

    public TelemetryPacket(string deviceId, string zone, SensorCategory category, T value, DateTime? timestamp = null)
    {
        if (string.IsNullOrWhiteSpace(deviceId))
            throw new ArgumentException("Device ID is required.", nameof(deviceId));

        if (string.IsNullOrWhiteSpace(zone))
            throw new ArgumentException("Zone is required.", nameof(zone));

        DeviceId = deviceId;
        Zone = zone;
        Category = category;
        Value = value;
        Timestamp = timestamp ?? DateTime.UtcNow;
    }

    public override string ToString() =>
        $"[{Timestamp:HH:mm:ss}] {DeviceId,-14} ({Zone,-16}, {Category,-13}) = {Value}";
}
