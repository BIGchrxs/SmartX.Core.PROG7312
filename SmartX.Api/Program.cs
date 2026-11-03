using System.Text.RegularExpressions;
using SmartX.Api.Endpoints;
using SmartX.Api.Models;
using SmartX.Api.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// One shared instance of each service, so requests and the background workers see the same state.
builder.Services.AddSingleton<SensorRegistry>();
builder.Services.AddSingleton<ThresholdPolicy>();
builder.Services.AddSingleton<IngestionQueue>();
builder.Services.AddSingleton<TelemetryHistory>();
builder.Services.AddSingleton<AlertTracker>();
builder.Services.AddSingleton<CommandService>();
builder.Services.AddSingleton<ActivityLog>();
builder.Services.AddSingleton<InsightEngine>();
builder.Services.AddSingleton<MeshNetwork>();
builder.Services.AddSingleton<TelemetryArchive>();

// Background workers: one drains the ingestion queues, one watches for silent devices.
builder.Services.AddHostedService<TelemetryProcessor>();
builder.Services.AddHostedService<DisconnectMonitor>();

builder.Services.AddCors();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();

// Device IDs may hold letters, numbers, dashes, underscores, dots and colons (so MAC addresses work).
var deviceIdPattern = new Regex(@"^[A-Za-z0-9._:-]{1,64}$", RegexOptions.Compiled);

// GET /sensors: list every registered sensor (used by the dashboard's live grid).
app.MapGet("/sensors", (SensorRegistry registry) => registry.All);
//-----------//

// POST /sensors: register a new sensor with its device ID, hardware address, zone, category and value type.
app.MapPost("/sensors", (SensorRegistration request, SensorRegistry registry, MeshNetwork mesh) =>
{
    if (string.IsNullOrWhiteSpace(request.DeviceId))
        return Results.BadRequest("DeviceId is required.");

    if (!deviceIdPattern.IsMatch(request.DeviceId) || request.DeviceId is "." or "..")
        return Results.BadRequest("DeviceId may only contain letters, numbers, dashes, underscores, dots and colons (64 characters at most).");

    if (!DeviceNode.ValidateDeploymentPath(registry.Root, $"Studio HQ/{request.Zone}"))
        return Results.UnprocessableEntity($"Zone '{request.Zone}' is not a registered deployment path.");

    // A device may bring its own hardware address. Otherwise the mesh supplies the one it already
    // holds for this node, and a device new to the mesh gets a stable address derived from its ID.
    if (string.IsNullOrWhiteSpace(request.MacAddress))
        request.MacAddress = mesh.MacFor(request.DeviceId) ?? MacAddressPolicy.Generate(request.DeviceId);

    if (!MacAddressPolicy.IsValid(request.MacAddress))
        return Results.BadRequest("MacAddress must be six pairs of hex digits separated by colons, for example 24:6F:28:A1:4B:01.");

    request.MacAddress = MacAddressPolicy.Normalise(request.MacAddress);

    if (registry.MacInUse(request.MacAddress, request.DeviceId))
        return Results.Conflict($"Hardware address '{request.MacAddress}' already belongs to another device.");

    if (!registry.TryRegister(request))
        return Results.Conflict($"Sensor '{request.DeviceId}' is already registered.");

    // A registered sensor becomes a vertex in the mesh straight away, so it shows up in the topology.
    mesh.EnsureSensor(request.DeviceId, request.MacAddress, request.Zone);

    return Results.Created($"/sensors/{request.DeviceId}", request);
});
//-----------//

// GET /sensors/{id}: look up one registered sensor.
app.MapGet("/sensors/{id}", (string id, SensorRegistry registry) =>
    registry.TryGet(id, out var sensor) ? Results.Ok(sensor) : Results.NotFound());
//-----------//

// GET /sensors/by-mac/{mac}: look a sensor up by its hardware address, through the MAC index.
app.MapGet("/sensors/by-mac/{mac}", (string mac, SensorRegistry registry) =>
{
    if (!MacAddressPolicy.IsValid(mac))
        return Results.BadRequest("MacAddress must be six pairs of hex digits separated by colons.");

    return registry.TryGetByMac(MacAddressPolicy.Normalise(mac), out var sensor) && sensor is not null
        ? Results.Ok(sensor)
        : Results.NotFound($"No sensor is registered with hardware address '{mac}'.");
});
//-----------//

// POST /sensors/{id}/media: attach a config file, deployment photo or log to a sensor profile.
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

    // Folder names cannot hold colons on Windows, so anything unusual becomes an underscore.
    var folderName = new string(sensor.DeviceId.Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' ? c : '_').ToArray());
    var uploadsDir = Path.Combine(env.ContentRootPath, "uploads", folderName);
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
//-----------//

// Part 2 routes live in their own classes under Endpoints.
app.MapTelemetryEndpoints();
app.MapCommandEndpoints();
app.MapAlertEndpoints();
app.MapInsightEndpoints();
app.MapTopologyEndpoints();

// Let the React dev server (localhost:5173) call this API directly without hitting CORS.
app.UseCors(policy => policy.WithOrigins("http://localhost:5173").AllowAnyMethod().AllowAnyHeader());

app.Run();
