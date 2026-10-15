using SmartX.Api.Models;
using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

/// <summary>Manual override commands and the undo stack.</summary>
public static class CommandEndpoints
{
    // Registers the command routes.
    public static void MapCommandEndpoints(this WebApplication app)
    {
        // POST /commands: switch an actuator on or off and push the command onto the undo stack.
        app.MapPost("/commands", (CommandRequest request, CommandService commands, ActivityLog activity) =>
        {
            if (string.IsNullOrWhiteSpace(request.DeviceId))
                return Results.BadRequest("DeviceId is required.");

            var result = commands.Execute(request.DeviceId, request.On, request.Source ?? "operator");
            if (!result.Ok)
                return Results.Text(result.Error!, statusCode: result.StatusCode);

            activity.RecordCommand(result.Entry!.DeviceId, result.Entry.NewState, result.Entry.Source);
            return Results.Ok(result.Entry);
        });
        //-----------//

        // POST /commands/undo: pop the most recent command and restore the previous state.
        app.MapPost("/commands/undo", (CommandService commands) =>
        {
            var result = commands.Undo();
            return result.Ok
                ? Results.Ok(result.Entry)
                : Results.Text(result.Error!, statusCode: result.StatusCode);
        });
        //-----------//

        // GET /commands/history: the undo stack, newest command first.
        app.MapGet("/commands/history", (CommandService commands) =>
        {
            var list = commands.History();
            return Results.Ok(new { count = list.Count, canUndo = list.Count > 0, commands = list });
        });
        //-----------//
    }
    //-----------//
}
