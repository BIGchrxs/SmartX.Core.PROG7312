using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// Background timer that raises a Disconnected alert for any device that has gone quiet. It uses
/// the same 45 second limit as the dashboard. The alert set makes sure each silent device alerts
/// once, however many times the timer fires.
/// </summary>
public class DisconnectMonitor : BackgroundService
{
    private readonly SensorRegistry _registry;
    private readonly AlertTracker _alerts;

    // Needs the registry to read last-seen times and the tracker to raise alerts.
    public DisconnectMonitor(SensorRegistry registry, AlertTracker alerts)
    {
        _registry = registry;
        _alerts = alerts;
    }
    //-----------//

    // Checks for silent devices every few seconds until the API stops.
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(SmartXConstants.DisconnectCheckSeconds));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
                CheckForSilentDevices();
        }
        catch (OperationCanceledException)
        {
            // The API is shutting down, so stop quietly.
        }
    }
    //-----------//

    // Raises a Disconnected alert for every device silent past the limit. Devices that have never reported are skipped.
    private void CheckForSilentDevices()
    {
        var now = DateTime.UtcNow;

        foreach (var sensor in _registry.All)
        {
            if (sensor.LastSeenAt is null)
                continue;

            var silentSeconds = (now - sensor.LastSeenAt.Value).TotalSeconds;
            if (silentSeconds >= SmartXConstants.CriticalAfterSeconds)
                _alerts.TryRaise(sensor.DeviceId, AlertType.Disconnected, $"{sensor.DeviceId} has not reported for {silentSeconds:0} seconds");
        }
    }
    //-----------//
}
