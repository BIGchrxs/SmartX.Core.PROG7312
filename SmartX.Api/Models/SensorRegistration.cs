namespace SmartX.Api.Models;

public class SensorRegistration
{
    public required string DeviceId { get; set; }       // unique identifier, e.g. ITC-TEMP-01
    public string MacAddress { get; set; } = "";         // hardware address of the ESP32 chip
    public required string Zone { get; set; }            // deployment location, e.g. "IT Closet"
    public required SensorCategory Category { get; set; }
    public required TelemetryValueType ValueType { get; set; }
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
    public List<string> MediaFiles { get; set; } = new();


    public object? LastValue { get; set; }
    public DateTime? LastSeenAt { get; set; }
}
