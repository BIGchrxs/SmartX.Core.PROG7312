using System.Diagnostics.CodeAnalysis;
using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>A snapshot of the queues, returned by GET /queues/status.</summary>
public sealed record QueueStatus(
    int FifoDepth,
    int PriorityDepth,
    long TotalEnqueued,
    long TotalProcessed,
    long CriticalProcessed,
    DateTime? LastCriticalAt,
    int LastCriticalBypassedBacklog,
    int ProcessingDelayMs);

/// <summary>
/// The front door for telemetry. Normal readings wait in a FIFO Queue&lt;T&gt;. Critical readings
/// go into a PriorityQueue and are always served first, so they bypass the FIFO backlog.
/// A SemaphoreSlim wakes the worker the moment something arrives, so there is no polling delay.
/// </summary>
public class IngestionQueue
{
    private readonly object _lock = new();
    private readonly Queue<QueuedReading> _fifo = new();
    private readonly PriorityQueue<QueuedReading, (int NegativePriority, long Sequence)> _priority = new();
    private readonly SemaphoreSlim _signal = new(0);

    private long _sequence;
    private long _enqueued;
    private long _processed;
    private long _criticalProcessed;
    private DateTime? _lastCriticalAt;
    private int _lastBypassedBacklog;
    private int _processingDelayMs;

    // Artificial per-reading delay for demos, so a backlog is visible. Zero in normal use.
    public int ProcessingDelayMs
    {
        get => Volatile.Read(ref _processingDelayMs);
        set => Volatile.Write(ref _processingDelayMs, Math.Clamp(value, 0, 500));
    }

    // Adds a reading to the right queue and wakes the worker.
    public void Enqueue(QueuedReading reading)
    {
        lock (_lock)
        {
            if (reading.Severity == ReadingSeverity.Critical)
            {
                // Min-heap, so a bigger priority is stored as a smaller number.
                // The sequence keeps equal priorities in arrival order.
                _priority.Enqueue(reading, (-reading.Priority, _sequence++));
            }
            else
            {
                _fifo.Enqueue(reading);
            }

            _enqueued++;
        }

        _signal.Release();
    }
    //-----------//

    // Waits until at least one reading is available.
    public Task WaitAsync(CancellationToken cancellationToken) => _signal.WaitAsync(cancellationToken);
    //-----------//

    // Takes the next reading. Critical readings always come first, then FIFO order.
    public bool TryDequeue([NotNullWhen(true)] out QueuedReading? reading)
    {
        lock (_lock)
        {
            if (_priority.Count > 0)
            {
                reading = _priority.Dequeue();
                _criticalProcessed++;
                _processed++;
                _lastCriticalAt = DateTime.UtcNow;
                _lastBypassedBacklog = _fifo.Count;
                return true;
            }

            if (_fifo.Count > 0)
            {
                reading = _fifo.Dequeue();
                _processed++;
                return true;
            }
        }

        reading = null;
        return false;
    }
    //-----------//

    // Returns the current queue depths and counters.
    public QueueStatus Status()
    {
        lock (_lock)
        {
            return new QueueStatus(
                _fifo.Count,
                _priority.Count,
                _enqueued,
                _processed,
                _criticalProcessed,
                _lastCriticalAt,
                _lastBypassedBacklog,
                ProcessingDelayMs);
        }
    }
    //-----------//
}
