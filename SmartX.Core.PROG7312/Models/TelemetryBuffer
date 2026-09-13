namespace SmartX.Api.Models;


public class TelemetryBuffer<T>
{
    private readonly string[] _zones;
    private readonly TelemetryPacket<T>?[][] _batches; // jagged: each row sized independently per zone
    private readonly int[] _counts;
    private readonly List<TelemetryPacket<T>> _flushed = new();

    /// <param name="zoneCapacities">
    /// One entry per zone: (zone name, batch capacity for that zone). Capacities can
    /// differ between zones — e.g. the IT Closet reports more often than Material
    /// Storage — which is exactly what makes this a jagged array rather than a
    /// rectangular (multi-dimensional) one.
    /// </param>
    public TelemetryBuffer(params (string Zone, int Capacity)[] zoneCapacities)
    {
        if (zoneCapacities.Length == 0)
            throw new ArgumentException("At least one zone must be configured.", nameof(zoneCapacities));

        _zones = zoneCapacities.Select(z => z.Zone).ToArray();
        _batches = zoneCapacities.Select(z => new TelemetryPacket<T>?[z.Capacity]).ToArray();
        _counts = new int[zoneCapacities.Length];
    }

    /// <summary>Every packet flushed so far, across all zones — the optimised List<T>.</summary>
    public IReadOnlyList<TelemetryPacket<T>> Flushed => _flushed;

    public void Add(TelemetryPacket<T> packet)
    {
        int zoneIndex = Array.IndexOf(_zones, packet.Zone);
        if (zoneIndex < 0)
            throw new ArgumentException($"Zone '{packet.Zone}' is not registered with this buffer.", nameof(packet));

        _batches[zoneIndex][_counts[zoneIndex]] = packet;
        _counts[zoneIndex]++;

        if (_counts[zoneIndex] == _batches[zoneIndex].Length)
            FlushZone(zoneIndex);
    }

    private void FlushZone(int zoneIndex)
    {
        foreach (var packet in _batches[zoneIndex])
        {
            if (packet is not null)
                _flushed.Add(packet);
        }

        Array.Clear(_batches[zoneIndex]);
        _counts[zoneIndex] = 0;
    }
}