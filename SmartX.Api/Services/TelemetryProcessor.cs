using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// Background worker that drains the ingestion queues. It is woken by the queue's signal, so a
/// critical reading is picked up immediately. For each reading it updates the sensor, the jagged
/// buffers, the sorted history and the alert state.
/// </summary>
public class TelemetryProcessor : BackgroundService
{
    private readonly IngestionQueue _queue;
    private readonly SensorRegistry _registry;
    private readonly TelemetryHistory _history;
    private readonly AlertTracker _alerts;
    private readonly ILogger<TelemetryProcessor> _logger;

    // Receives the services the worker writes to.
    public TelemetryProcessor(
        IngestionQueue queue,
        SensorRegistry registry,
        TelemetryHistory history,
        AlertTracker alerts,
        ILogger<TelemetryProcessor> logger)
    {
        _queue = queue;
        _registry = registry;
        _history = history;
        _alerts = alerts;
        _logger = logger;
    }
    //-----------//

    // Waits for a signal, takes the next reading (critical first) and processes it.
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await _queue.WaitAsync(stoppingToken);

                if (!_queue.TryDequeue(out var reading))
                    continue;

                try
                {
                    Process(reading);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Could not process a reading from {DeviceId}", reading.DeviceId);
                }

                var delay = _queue.ProcessingDelayMs;
                if (delay > 0)
                    await Task.Delay(delay, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // The API is shutting down, so stop quietly.
        }
    }
    //-----------//

    // Applies one reading to the sensor, buffers, history and alerts.
    private void Process(QueuedReading reading)
    {
        if (!_registry.TryGet(reading.DeviceId, out var sensor) || sensor is null)
            return;

        sensor.LastValue = reading.Value;
        sensor.LastSeenAt = reading.Timestamp;

        AddToBuffer(reading);
        _history.Add(reading);
        UpdateAlerts(reading);
    }
    //-----------//

    // Adds the reading to the typed jagged-array buffer that matches its value type.
    private void AddToBuffer(QueuedReading reading)
    {
        lock (_registry.BufferLock)
        {
            switch (reading.ValueType)
            {
                case TelemetryValueType.Float:
                    _registry.FloatBuffer.Add(new TelemetryPacket<float>(
                        reading.DeviceId, reading.Zone, reading.Category, (float)reading.Value, reading.Timestamp));
                    break;

                case TelemetryValueType.Int:
                    _registry.IntBuffer.Add(new TelemetryPacket<int>(
                        reading.DeviceId, reading.Zone, reading.Category, (int)reading.Value, reading.Timestamp));
                    break;

                case TelemetryValueType.Bool:
                    _registry.BoolBuffer.Add(new TelemetryPacket<bool>(
                        reading.DeviceId, reading.Zone, reading.Category, (bool)reading.Value, reading.Timestamp));
                    break;
            }
        }
    }
    //-----------//

    // Raises or clears alerts. The set inside the tracker stops a repeat from alerting twice.
    private void UpdateAlerts(QueuedReading reading)
    {
        // Any reading means the device is talking again.
        _alerts.Clear(reading.DeviceId, AlertType.Disconnected);

        switch (reading.Severity)
        {
            case ReadingSeverity.Critical:
                _alerts.TryRaise(reading.DeviceId, AlertType.Critical, reading.Reason ?? "Critical reading");
                _alerts.Clear(reading.DeviceId, AlertType.OutOfRange);
                break;

            case ReadingSeverity.Warning:
                _alerts.TryRaise(reading.DeviceId, AlertType.OutOfRange, reading.Reason ?? "Reading out of range");
                _alerts.Clear(reading.DeviceId, AlertType.Critical);
                break;

            default:
                _alerts.Clear(reading.DeviceId, AlertType.Critical);
                _alerts.Clear(reading.DeviceId, AlertType.OutOfRange);
                break;
        }
    }
    //-----------//
}
