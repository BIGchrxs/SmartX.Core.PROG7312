using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// Handles manual override commands. Every command is pushed onto a Stack&lt;CommandEntry&gt;,
/// so Undo always reverts the most recent command first (last in, first out).
/// </summary>
public class CommandService
{
    private readonly object _lock = new();
    private readonly Stack<CommandEntry> _history = new();
    private readonly SensorRegistry _registry;
    private long _nextId = 1;

    // Needs the registry to find actuators and change their state.
    public CommandService(SensorRegistry registry)
    {
        _registry = registry;
    }
    //-----------//

    // Switches an actuator on or off and pushes the command onto the undo stack.
    public CommandResult Execute(string deviceId, bool on, string source)
    {
        if (!_registry.TryGet(deviceId, out var sensor) || sensor is null)
            return CommandResult.Fail(404, $"Sensor '{deviceId}' is not registered.");

        if (sensor.Category != SensorCategory.Actuator || sensor.ValueType != TelemetryValueType.Bool)
            return CommandResult.Fail(422, $"'{sensor.DeviceId}' is not an on/off actuator, so it cannot take commands.");

        lock (_lock)
        {
            var previous = sensor.LastValue is bool current && current;
            var entry = new CommandEntry(_nextId++, sensor.DeviceId, on, previous, DateTime.UtcNow, source);

            _history.Push(entry);
            sensor.LastValue = on;

            return CommandResult.Success(entry);
        }
    }
    //-----------//

    // Pops the latest command and puts the actuator back to its previous state.
    public CommandResult Undo()
    {
        lock (_lock)
        {
            if (_history.Count == 0)
                return CommandResult.Fail(409, "There are no commands to undo.");

            var entry = _history.Pop();

            if (_registry.TryGet(entry.DeviceId, out var sensor) && sensor is not null)
                sensor.LastValue = entry.PreviousState;

            return CommandResult.Success(entry);
        }
    }
    //-----------//

    // The command history with the newest command first, which is the next one Undo will revert.
    public IReadOnlyList<CommandEntry> History()
    {
        lock (_lock)
        {
            return _history.ToArray();
        }
    }
    //-----------//
}
