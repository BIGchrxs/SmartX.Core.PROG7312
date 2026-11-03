using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

/// <summary>
/// Part 3 routes: the mesh graph, its traversals and spanning trees, the routing path a node's
/// telemetry takes back to the gateway, and the AVL archive behind the historical log.
/// </summary>
public static class TopologyEndpoints
{
    // Registers every topology and archive route.
    public static void MapTopologyEndpoints(this WebApplication app)
    {
        // GET /mesh: every node and link, plus both spanning trees, which is all the dashboard needs to draw.
        app.MapGet("/mesh", (MeshNetwork mesh) =>
        {
            var prim = mesh.PrimMst();
            var kruskal = mesh.KruskalMst();

            return Results.Ok(new
            {
                gatewayId = MeshNetwork.GatewayId,
                nodes = mesh.Nodes(),
                links = mesh.Links(),
                prim,
                kruskal,
                // Two different algorithms reaching one total is a strong sign both are correct.
                algorithmsAgree = prim.TotalCost == kruskal.TotalCost && prim.Edges.Count == kruskal.Edges.Count
            });
        });
        //-----------//

        // GET /mesh/traversal: walk the mesh from one node and report what it can and cannot reach.
        app.MapGet("/mesh/traversal", (string? start, string? algorithm, MeshNetwork mesh) =>
        {
            var from = string.IsNullOrWhiteSpace(start) ? MeshNetwork.GatewayId : start;
            var node = mesh.Find(from);

            if (node is null)
                return Results.NotFound($"'{from}' is not a node in the mesh.");

            var wantsDepth = string.Equals(algorithm, "dfs", StringComparison.OrdinalIgnoreCase);
            return Results.Ok(wantsDepth ? mesh.Dfs(node.Id) : mesh.Bfs(node.Id));
        });
        //-----------//

        // GET /mesh/route/{idOrMac}: the hops a node's telemetry takes to the gateway, by ID or MAC address.
        app.MapGet("/mesh/route/{idOrMac}", (string idOrMac, MeshNetwork mesh) =>
        {
            var node = mesh.Find(idOrMac);

            if (node is null)
                return Results.NotFound($"No mesh node matches '{idOrMac}'.");

            var spanning = mesh.RouteThroughMst(node.Id);
            var cheapest = mesh.CheapestRoute(node.Id);

            return Results.Ok(new
            {
                node,
                spanning,
                cheapest,
                // The tree keeps the whole network's power down, so one node's own route can be dearer.
                spanningCostsMore = spanning.Reachable && cheapest.Reachable && spanning.TotalCost > cheapest.TotalCost
            });
        });
        //-----------//

        // POST /mesh/nodes/{id}/power: switch a node off or on, to show the mesh healing around a failure.
        app.MapPost("/mesh/nodes/{id}/power", (string id, bool? on, MeshNetwork mesh) =>
        {
            var node = mesh.Find(id);

            if (node is null)
                return Results.NotFound($"No mesh node matches '{id}'.");

            if (string.Equals(node.Id, MeshNetwork.GatewayId, StringComparison.OrdinalIgnoreCase))
                return Results.UnprocessableEntity("The gateway cannot be powered down. Everything routes back to it.");

            mesh.SetOnline(node.Id, on ?? false);
            return Results.Ok(new { node.Id, online = on ?? false, reachability = mesh.Bfs(MeshNetwork.GatewayId) });
        });
        //-----------//

        // POST /mesh/reset: bring every node back online.
        app.MapPost("/mesh/reset", (MeshNetwork mesh) =>
        {
            mesh.ResetOutages();
            return Results.Ok(new { restored = true, reachability = mesh.Bfs(MeshNetwork.GatewayId) });
        });
        //-----------//

        // GET /archive/{deviceId}: the newest archived readings for a device, straight out of the AVL tree.
        app.MapGet("/archive/{deviceId}", (string deviceId, int? limit, SensorRegistry registry, TelemetryArchive archive) =>
        {
            if (!registry.TryGet(deviceId, out var sensor) || sensor is null)
                return Results.NotFound($"Sensor '{deviceId}' is not registered.");

            var points = archive.Recent(sensor.DeviceId, Math.Clamp(limit ?? 50, 1, 500));
            return Results.Ok(new { deviceId = sensor.DeviceId, count = points.Count, stats = archive.Stats(sensor.DeviceId), points });
        });
        //-----------//

        // GET /archive/{deviceId}/range: the range query, with the cost of the tree walk next to a plain scan.
        app.MapGet("/archive/{deviceId}/range", (string deviceId, DateTime from, DateTime to, SensorRegistry registry, TelemetryArchive archive) =>
        {
            if (!registry.TryGet(deviceId, out var sensor) || sensor is null)
                return Results.NotFound($"Sensor '{deviceId}' is not registered.");

            if (to < from)
                return Results.BadRequest("The end of the range cannot be before its start.");

            var (points, report) = archive.RangeQuery(sensor.DeviceId, AsUtc(from), AsUtc(to));
            return Results.Ok(new { report, count = points.Count, points });
        });
        //-----------//

        // GET /archive/{deviceId}/balance-proof: the same readings in a balanced and an unbalanced tree.
        app.MapGet("/archive/{deviceId}/balance-proof", (string deviceId, int? sample, SensorRegistry registry, TelemetryArchive archive) =>
        {
            if (!registry.TryGet(deviceId, out var sensor) || sensor is null)
                return Results.NotFound($"Sensor '{deviceId}' is not registered.");

            return Results.Ok(archive.BalanceProof(sensor.DeviceId, sample ?? 2000));
        });
        //-----------//

        // GET /archive: how much history the archive holds, per device and in total.
        app.MapGet("/archive", (TelemetryArchive archive) =>
        {
            var (devices, readings) = archive.Totals();
            return Results.Ok(new
            {
                devices,
                readings,
                perDevice = archive.Devices().Select(archive.Stats)
            });
        });
        //-----------//

        // POST /demo/backfill: fill the archive with back dated readings, so the tree can be shown
        // working over a history far longer than a live demo could produce.
        app.MapPost("/demo/backfill", (int? readings, SensorRegistry registry, TelemetryArchive archive) =>
        {
            var perDevice = Math.Clamp(readings ?? 2000, 100, 20000);
            var filled = 0;

            foreach (var sensor in registry.All.Where(s => s.ValueType != Models.TelemetryValueType.Bool))
            {
                var level = sensor.Category == Models.SensorCategory.Power ? 900 : 40;
                var swing = sensor.Category == Models.SensorCategory.Power ? 120 : 8;
                filled += archive.Backfill(sensor.DeviceId, perDevice, level, swing, TimeSpan.FromSeconds(30));
            }

            var (devices, total) = archive.Totals();
            return Results.Ok(new { backfilled = filled, devices, readings = total });
        });
        //-----------//
    }
    //-----------//

    // Treats a date with no time zone as UTC, because every archived timestamp is UTC.
    private static DateTime AsUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime();
    //-----------//
}
