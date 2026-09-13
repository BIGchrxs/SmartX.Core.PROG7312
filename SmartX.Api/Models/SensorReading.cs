namespace SmartX.Core.PROG7312.Models;

public readonly struct SensorReading
{
    public string DeviceId { get; }
    public double Value { get; }
    public DateTime Timestamp { get; }

    public SensorReading(string deviceId, double value, DateTime? timestamp = null)
    {
        DeviceId = deviceId ?? throw new ArgumentNullException(nameof(deviceId));
        Value = value;
        Timestamp = timestamp ?? DateTime.UtcNow;
    }

    public static SensorReading operator +(SensorReading a, SensorReading b) =>
        new($"{a.DeviceId}+{b.DeviceId}", a.Value + b.Value);

    public static SensorReading operator -(SensorReading a, SensorReading b) =>
        new($"{a.DeviceId}-{b.DeviceId}", a.Value - b.Value);

    public static bool operator >(SensorReading a, double threshold) => a.Value > threshold;
    public static bool operator <(SensorReading a, double threshold) => a.Value < threshold;
    public static bool operator >=(SensorReading a, double threshold) => a.Value >= threshold;
    public static bool operator <=(SensorReading a, double threshold) => a.Value <= threshold;

    public override string ToString() => $"{DeviceId}: {Value:F2}";
}
