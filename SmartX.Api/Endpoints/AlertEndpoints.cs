using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

/// <summary>The active alert set and the alert log.</summary>
public static class AlertEndpoints
{
    // Registers the alert routes.
    public static void MapAlertEndpoints(this WebApplication app)
    {
        // GET /alerts/active: the current contents of the alert set. A device never appears twice for the same problem.
        app.MapGet("/alerts/active", (AlertTracker alerts) =>
        {
            var list = alerts.Active();
            return Results.Ok(new { count = list.Count, alerts = list });
        });
        //-----------//

        // GET /alerts/events: the alert log with raised and recovered entries, newest first,
        // plus how many repeat alerts the set refused.
        app.MapGet("/alerts/events", (int? limit, AlertTracker alerts) =>
        {
            var events = alerts.Events(Math.Clamp(limit ?? 50, 1, 200));
            return Results.Ok(new { raisedTotal = alerts.RaisedTotal, duplicatesIgnored = alerts.DuplicatesIgnored, events });
        });
        //-----------//
    }
    //-----------//
}
