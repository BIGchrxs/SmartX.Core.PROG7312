using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// Per-device timelines. Each device has a SortedDictionary keyed by timestamp, so readings
/// are always in time order and the dashboard never has to sort them. The devices themselves
/// are found through a case-insensitive Dictionary.
/// </summary>
public class TelemetryHistory
{
    private readonly object _lock = new();
    private readonly Dictionary<string, SortedDictionary<DateTime, HistoryPoint>> _byDevice =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> _zones = new(StringComparer.OrdinalIgnoreCase);

    // Stores a reading. A duplicate timestamp is nudged by one tick, because Add throws on duplicate keys.
    public void Add(QueuedReading reading)
    {
        lock (_lock)
        {
            if (!_byDevice.TryGetValue(reading.DeviceId, out var series))
            {
                series = new SortedDictionary<DateTime, HistoryPoint>();
                _byDevice[reading.DeviceId] = series;
            }

            var key = reading.Timestamp;
            while (series.ContainsKey(key))
                key = key.AddTicks(1);

            series[key] = new HistoryPoint(key, reading.NumericValue, reading.Severity);
            _zones[reading.DeviceId] = reading.Zone;

            // Keep memory flat by dropping the oldest entries past the cap.
            while (series.Count > SmartXConstants.HistoryCapPerDevice)
                series.Remove(series.Keys.First());
        }
    }
    //-----------//

    // Returns a device's readings in ascending time order, newest "limit" readings within the range.
    public IReadOnlyList<HistoryPoint> Get(string deviceId, DateTime? from, DateTime? to, int limit)
    {
        lock (_lock)
        {
            if (!_byDevice.TryGetValue(deviceId, out var series))
                return Array.Empty<HistoryPoint>();

            IEnumerable<HistoryPoint> points = series.Values;

            if (from is not null)
                points = points.Where(p => p.Timestamp >= from.Value);
            if (to is not null)
                points = points.Where(p => p.Timestamp <= to.Value);

            var list = points.ToList();
            return limit > 0 && list.Count > limit ? list.GetRange(list.Count - limit, limit) : list;
        }
    }
    //-----------//

    // Returns the newest "count" readings for a device, oldest first. Used for trend analysis.
    public IReadOnlyList<HistoryPoint> Window(string deviceId, int count)
    {
        return Get(deviceId, null, null, count);
    }
    //-----------//

    // Returns the newest readings across all devices, newest first, for the live feed.
    public IReadOnlyList<RecentReading> Recent(int limit)
    {
        lock (_lock)
        {
            var merged = new List<RecentReading>();

            foreach (var (deviceId, series) in _byDevice)
            {
                var zone = _zones.TryGetValue(deviceId, out var z) ? z : "";
                foreach (var point in series.Values.TakeLast(limit))
                    merged.Add(new RecentReading(deviceId, zone, point.Timestamp, point.Value, point.Severity));
            }

            return merged.OrderByDescending(r => r.Timestamp).Take(limit).ToList();
        }
    }
    //-----------//

    // The IDs of every device that has at least one stored reading.
    public IReadOnlyList<string> Devices()
    {
        lock (_lock)
        {
            return _byDevice.Keys.ToArray();
        }
    }
    //-----------//
}
