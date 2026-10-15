using SmartX.Api.Models;
using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

/// <summary>The suggestion engine: insights, the operator activity log and the demo history seed.</summary>
public static class InsightEndpoints
{
    // Registers the insight, activity and demo routes.
    public static void MapInsightEndpoints(this WebApplication app)
    {
        // GET /insights: alerts, trends and learned habits, most urgent first.
        app.MapGet("/insights", (InsightEngine engine) =>
        {
            var insights = engine.Build();
            return Results.Ok(new { generatedAt = DateTime.UtcNow, count = insights.Count, insights });
        });
        //-----------//

        // POST /activity/search: log a settled search so the engine can learn from it.
        app.MapPost("/activity/search", (SearchLogRequest request, ActivityLog activity) =>
        {
            if (string.IsNullOrWhiteSpace(request.Term))
                return Results.BadRequest("Term is required.");

            activity.RecordSearch(request.Term);
            return Results.NoContent();
        });
        //-----------//

        // GET /activity: the newest logged searches and commands.
        app.MapGet("/activity", (int? limit, ActivityLog activity) =>
        {
            var events = activity.Events(Math.Clamp(limit ?? 50, 1, 200));
            return Results.Ok(new { count = events.Count, events });
        });
        //-----------//

        // POST /demo/seed-history: add a believable operator history so suggestions show immediately.
        app.MapPost("/demo/seed-history", (ActivityLog activity) =>
            activity.SeedDemoHistory()
                ? Results.Ok(new { seeded = true, message = "Demo history added. Run the humidity-high or server-hot scenario to see suggestions." })
                : Results.Text("Demo history has already been added.", statusCode: StatusCodes.Status409Conflict));
        //-----------//
    }
    //-----------//
}
