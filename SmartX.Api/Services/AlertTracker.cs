using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// Tracks which alerts are active. A HashSet&lt;string&gt; of "deviceId:Type" keys is the gate:
/// Add returns false for a duplicate, so the same problem on the same device never raises a
/// second alert until it has recovered. A set gives constant-time Add, Remove and Contains and
/// makes duplicates impossible by construction, which a List would need a scan to prevent.
/// </summary>
public class AlertTracker
{
    private const int MaxEvents = 200;

    private readonly object _lock = new();
    private readonly HashSet<string> _active = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, ActiveAlert> _details = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, int> _incidents = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<AlertEvent> _events = new();
    private long _raisedTotal;
    private long _duplicatesIgnored;

    // How many times the set refused a repeat of an alert that was already active.
    public long DuplicatesIgnored
    {
        get
        {
            lock (_lock)
            {
                return _duplicatesIgnored;
            }
        }
    }
    //-----------//

    // Total number of alerts ever raised, including ones that have recovered.
    public long RaisedTotal
    {
        get
        {
            lock (_lock)
            {
                return _raisedTotal;
            }
        }
    }

    // Builds the set key for a device and alert type.
    public static string KeyFor(string deviceId, AlertType type) => $"{deviceId}:{type}";
    //-----------//

    // Raises an alert. Returns true only when it was not already active.
    public bool TryRaise(string deviceId, AlertType type, string message)
    {
        var key = KeyFor(deviceId, type);

        lock (_lock)
        {
            if (!_active.Add(key))
            {
                _duplicatesIgnored++;
                return false;
            }

            var now = DateTime.UtcNow;
            _details[key] = new ActiveAlert(key, deviceId, type, message, now);
            _incidents[key] = _incidents.TryGetValue(key, out var n) ? n + 1 : 1;
            _raisedTotal++;
            Log(new AlertEvent(now, key, "Raised", message));
            return true;
        }
    }
    //-----------//

    // Clears an alert once the device has recovered. Returns true only if it was active.
    public bool Clear(string deviceId, AlertType type)
    {
        var key = KeyFor(deviceId, type);

        lock (_lock)
        {
            if (!_active.Remove(key))
                return false;

            _details.Remove(key);
            Log(new AlertEvent(DateTime.UtcNow, key, "Recovered", $"{deviceId} recovered from {type}"));
            return true;
        }
    }
    //-----------//

    // Every alert that is active right now, oldest first.
    public IReadOnlyList<ActiveAlert> Active()
    {
        lock (_lock)
        {
            return _details.Values.OrderBy(a => a.RaisedAt).ToList();
        }
    }
    //-----------//

    // The keys of every active alert. The suggestion engine treats these as conditions.
    public IReadOnlyList<string> ActiveKeys()
    {
        lock (_lock)
        {
            return _active.ToArray();
        }
    }
    //-----------//

    // How many separate times this alert has been raised so far.
    public int IncidentCount(string key)
    {
        lock (_lock)
        {
            return _incidents.TryGetValue(key, out var n) ? n : 0;
        }
    }
    //-----------//

    // Adds past incidents for demo history so confidence values make sense.
    public void SeedIncidents(string key, int count)
    {
        lock (_lock)
        {
            _incidents[key] = (_incidents.TryGetValue(key, out var n) ? n : 0) + count;
        }
    }
    //-----------//

    // The newest alert log entries, newest first.
    public IReadOnlyList<AlertEvent> Events(int limit)
    {
        lock (_lock)
        {
            return _events.AsEnumerable().Reverse().Take(limit).ToList();
        }
    }
    //-----------//

    // Adds a log entry and trims the log to its cap. Call only while holding the lock.
    private void Log(AlertEvent entry)
    {
        _events.Add(entry);
        if (_events.Count > MaxEvents)
            _events.RemoveAt(0);
    }
    //-----------//
}
