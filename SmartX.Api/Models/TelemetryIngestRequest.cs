using System.Text.Json;

namespace SmartX.Api.Models;

public class TelemetryIngestRequest
{
    public required string DeviceId { get; set; }
    public required JsonElement Value { get; set; }
}
