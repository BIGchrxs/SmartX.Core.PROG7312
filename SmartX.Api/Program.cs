using SmartX.Api.Models;
using SmartX.Api.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<SensorRegistry>();
builder.Services.AddCors();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();

// GET /sensors — list every registered sensor (used by the dashboard's live grid)
app.MapGet("/sensors", (SensorRegistry registry) => registry.All);

// POST /sensors — register a new sensor: MAC address, zone, category, value type
app.MapPost("/sensors", (SensorRegistration request, SensorRegistry registry) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceId))
        return Results.BadRequest("DeviceId is required.");

    if (!DeviceNode.ValidateDeploymentPath(registry.Root, $"Studio HQ/{request.Zone}"))
        return Results.UnprocessableEntity($"Zone '{request.Zone}' is not a registered deployment path.");

    if (!registry.TryRegister(request))
        return Results.Conflict($"Sensor '{request.DeviceId}' is already registered.");

    return Results.Created($"/sensors/{request.DeviceId}", request);
});

// GET /sensors/{id} — look up a registered sensor
app.MapGet("/sensors/{id}", (string id, SensorRegistry registry) =>
    registry.TryGet(id, out var sensor) ? Results.Ok(sensor) : Results.NotFound());

// POST /telemetry — ingest one reading for an already-registered sensor
app.MapPost("/telemetry", (TelemetryIngestRequest request, SensorRegistry registry) =>
{
    if (!registry.TryGet(request.DeviceId, out var sensor) || sensor is null)
        return Results.NotFound($"Sensor '{request.DeviceId}' is not registered.");

    switch (sensor.ValueType)
    {
        case TelemetryValueType.Float:
            var floatPacket = new TelemetryPacket<float>(sensor.DeviceId, sensor.Zone, sensor.Category, request.Value.GetSingle());
            registry.FloatBuffer.Add(floatPacket);
            sensor.LastValue = floatPacket.Value;
            sensor.LastSeenAt = floatPacket.Timestamp;
            return Results.Ok(floatPacket);

        case TelemetryValueType.Int:
            var intPacket = new TelemetryPacket<int>(sensor.DeviceId, sensor.Zone, sensor.Category, request.Value.GetInt32());
            registry.IntBuffer.Add(intPacket);
            sensor.LastValue = intPacket.Value;
            sensor.LastSeenAt = intPacket.Timestamp;
            return Results.Ok(intPacket);

        case TelemetryValueType.Bool:
            var boolPacket = new TelemetryPacket<bool>(sensor.DeviceId, sensor.Zone, sensor.Category, request.Value.GetBoolean());
            registry.BoolBuffer.Add(boolPacket);
            sensor.LastValue = boolPacket.Value;
            sensor.LastSeenAt = boolPacket.Timestamp;
            return Results.Ok(boolPacket);

        default:
            return Results.BadRequest("Unrecognised value type.");
    }
});

// GET /telemetry/flushed — quick way to see what's made it into the List<T> collections
app.MapGet("/telemetry/flushed", (SensorRegistry registry) => new
{
    floats = registry.FloatBuffer.Flushed,
    ints = registry.IntBuffer.Flushed,
    bools = registry.BoolBuffer.Flushed
});

// POST /sensors/{id}/media — attach a config file, deployment photo, or log to a sensor profile
app.MapPost("/sensors/{id}/media", async (string id, HttpRequest httpRequest, SensorRegistry registry, IWebHostEnvironment env) =>
{
    if (!registry.TryGet(id, out var sensor) || sensor is null)
        return Results.NotFound($"Sensor '{id}' is not registered.");

    if (!httpRequest.HasFormContentType)
        return Results.BadRequest("Expected multipart/form-data.");

    var form = await httpRequest.ReadFormAsync();
    var file = form.Files.GetFile("file");

    if (file is null || file.Length == 0)
        return Results.BadRequest("No file provided, or the uploaded file is empty (expected form field name 'file').");

    const long maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (file.Length > maxFileSizeBytes)
        return Results.BadRequest("File exceeds the 10 MB limit.");

    var uploadsDir = Path.Combine(env.ContentRootPath, "uploads", id);
    Directory.CreateDirectory(uploadsDir);

    var safeName = Path.GetFileName(file.FileName);
    var destination = Path.Combine(uploadsDir, safeName);

    await using (var stream = File.Create(destination))
    {
        await file.CopyToAsync(stream);
    }

    sensor.MediaFiles.Add(safeName);
    return Results.Ok(new { sensor.DeviceId, file = safeName, sizeBytes = file.Length });
});

// Let the React dev server (localhost:5173) call this API directly without hitting CORS.
app.UseCors(policy => policy.WithOrigins("http://localhost:5173").AllowAnyMethod().AllowAnyHeader());

app.Run();