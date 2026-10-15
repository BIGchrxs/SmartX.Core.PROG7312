using System.Text.Json;
using SmartX.Api.Models;
using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

/// <summary>
/// Telemetry ingestion, sorted history, the live feed and the queue status. Ingestion only
/// validates and enqueues, so the request returns straight away while the worker does the rest.
/// </summary>
public static class TelemetryEndpoints
{
    // Registers every telemetry and queue route.
    public static void MapTelemetryEndpoints(this WebApplication app)
    {
        // POST /telemetry: validate one reading, check it against the limits and queue it. Replies 202 Accepted.
        app.MapPost("/telemetry", (TelemetryIngestRequest request, SensorRegistry registry, ThresholdPolicy thresholds, IngestionQueue queue) =>
        {
            if (string.IsNullOrWhiteSpace(request.DeviceId))
                return Results.BadRequest("DeviceId is required.");

            if (!registry.TryGet(request.DeviceId, out var sensor) || sensor is null)
                return Results.NotFound($"Sensor '{request.DeviceId}' is not registered.");

            if (!TryReadValue(sensor, request.Value, out var value, out var numeric, out var error))
                return Results.BadRequest(error);

            var result = thresholds.Evaluate(sensor.Zone, sensor.Category, numeric);

            queue.Enqueue(new QueuedReading(
                sensor.DeviceId,
                sensor.Zone,
                sensor.Category,
                sensor.ValueType,
                value,
                numeric,
                DateTime.UtcNow,
                result.Severity,
                result.Priority,
                result.Reason));

            return Results.Accepted($"/sensors/{sensor.DeviceId}", new
            {
                deviceId = sensor.DeviceId,
                severity = result.Severity,
                queued = true
            });
        });
        //-----------//

        // GET /telemetry/flushed: readings that have completed a full batch in the jagged-array buffers.
        app.MapGet("/telemetry/flushed", (SensorRegistry registry) =>
        {
            lock (registry.BufferLock)
            {
                return Results.Ok(new
                {
                    floats = registry.FloatBuffer.Flushed.ToArray(),
                    ints = registry.IntBuffer.Flushed.ToArray(),
                    bools = registry.BoolBuffer.Flushed.ToArray()
                });
            }
        });
        //-----------//

        // GET /telemetry/history/{deviceId}: a device's readings, already sorted by time.
        app.MapGet("/telemetry/history/{deviceId}", (string deviceId, DateTime? from, DateTime? to, int? limit, SensorRegistry registry, TelemetryHistory history) =>
        {
            if (!registry.TryGet(deviceId, out var sensor) || sensor is null)
                return Results.NotFound($"Sensor '{deviceId}' is not registered.");

            var points = history.Get(sensor.DeviceId, AsUtc(from), AsUtc(to), Math.Clamp(limit ?? 100, 1, SmartXConstants.HistoryCapPerDevice));
            return Results.Ok(new { deviceId = sensor.DeviceId, count = points.Count, points });
        });
        //-----------//

        // GET /telemetry/recent: the newest readings across all devices, for the live feed.
        app.MapGet("/telemetry/recent", (int? limit, TelemetryHistory history) =>
            Results.Ok(history.Recent(Math.Clamp(limit ?? 20, 1, 100))));
        //-----------//

        // GET /queues/status: queue depths and counters, including how many readings a critical one jumped.
        app.MapGet("/queues/status", (IngestionQueue queue) => Results.Ok(queue.Status()));
        //-----------//

        // POST /queues/delay/{ms}: demo switch that slows the worker so a backlog becomes visible. Use 0 to reset.
        app.MapPost("/queues/delay/{ms:int}", (int ms, IngestionQueue queue) =>
        {
            queue.ProcessingDelayMs = ms;
            return Results.Ok(queue.Status());
        });
        //-----------//
    }
    //-----------//

    // Checks the JSON value matches the sensor's type and returns it in typed and numeric form.
    private static bool TryReadValue(SensorRegistration sensor, JsonElement json, out object value, out double numeric, out string error)
    {
        value = 0;
        numeric = 0;
        error = "";

        switch (sensor.ValueType)
        {
            case TelemetryValueType.Float:
                if (json.ValueKind == JsonValueKind.Number && json.TryGetSingle(out var f) && float.IsFinite(f))
                {
                    value = f;
                    numeric = Math.Round(f, 4);
                    return true;
                }
                error = "Expected a number for a Float sensor.";
                return false;

            case TelemetryValueType.Int:
                if (json.ValueKind == JsonValueKind.Number && json.TryGetInt32(out var i))
                {
                    value = i;
                    numeric = i;
                    return true;
                }
                error = "Expected a whole number for an Int sensor.";
                return false;

            case TelemetryValueType.Bool:
                if (json.ValueKind is JsonValueKind.True or JsonValueKind.False)
                {
                    var b = json.GetBoolean();
                    value = b;
                    numeric = b ? 1 : 0;
                    return true;
                }
                error = "Expected true or false for a Bool sensor.";
                return false;

            default:
                error = "Unrecognised value type.";
                return false;
        }
    }
    //-----------//

    // Treats a date with no time zone as UTC, because every stored timestamp is UTC.
    private static DateTime? AsUtc(DateTime? value)
    {
        if (value is null)
            return null;

        return value.Value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
            : value.Value.ToUniversalTime();
    }
    //-----------//
}
