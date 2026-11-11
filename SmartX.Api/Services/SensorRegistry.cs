using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// In-memory registry of sensors and the Smart-X deployment hierarchy, plus the
/// three typed jagged-array buffers that flush readings into List&lt;T&gt;. Registered
/// as a singleton so every request shares the same state.
/// Devices live in a case-insensitive Dictionary, so every lookup by ID is O(1). A second
/// dictionary maps hardware address to device ID, so a lookup by MAC address is O(1) as well and
/// never has to scan the device list.
/// </summary>
public class SensorRegistry
{
    private readonly Dictionary<string, SensorRegistration> _sensors = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> _byMac = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _lock = new();

    public DeviceNode Root { get; }
    public TelemetryBuffer<float> FloatBuffer { get; }
    public TelemetryBuffer<int> IntBuffer { get; }
    public TelemetryBuffer<bool> BoolBuffer { get; }

    // Guards the three buffers, which are written by the worker and read by requests.
    public object BufferLock { get; } = new();

    // Builds the zone tree and the three typed buffers.
    public SensorRegistry()
    {
        Root = BuildZoneTree();

        FloatBuffer = new TelemetryBuffer<float>(
            ("Showroom Floor", 3), ("Material Storage", 2), ("Workshop", 4), ("IT Closet", 2));
        IntBuffer = new TelemetryBuffer<int>(
            ("Showroom Floor", 3), ("Material Storage", 2), ("Workshop", 4), ("IT Closet", 2));
        BoolBuffer = new TelemetryBuffer<bool>(
            ("Showroom Floor", 3), ("Material Storage", 2), ("Workshop", 4), ("IT Closet", 2));
    }
    //-----------//

    // Builds the Studio HQ deployment tree used for recursive path validation.
    private static DeviceNode BuildZoneTree()
    {
        var root = new DeviceNode("Studio HQ");

        var showroom = new DeviceNode("Showroom Floor");
        showroom.AddChild(new DeviceNode("Window Bay 1"));

        var storage = new DeviceNode("Material Storage");
        storage.AddChild(new DeviceNode("Fabric Cabinet"));

        var workshop = new DeviceNode("Workshop");
        workshop.AddChild(new DeviceNode("Power Tool Circuit"));

        var itCloset = new DeviceNode("IT Closet");
        itCloset.AddChild(new DeviceNode("Server Rack A"));

        root.AddChild(showroom);
        root.AddChild(storage);
        root.AddChild(workshop);
        root.AddChild(itCloset);

        return root;
    }
    //-----------//

    // Adds a sensor and indexes its hardware address. Returns false if the device ID is already registered.
    public bool TryRegister(SensorRegistration sensor)
    {
        lock (_lock)
        {
            if (!_sensors.TryAdd(sensor.DeviceId, sensor))
                return false;

            if (!string.IsNullOrWhiteSpace(sensor.MacAddress))
                _byMac[sensor.MacAddress] = sensor.DeviceId;

            return true;
        }
    }
    //-----------//

    // True when a hardware address already belongs to a different device.
    public bool MacInUse(string mac, string exceptDeviceId)
    {
        lock (_lock)
        {
            return _byMac.TryGetValue(mac, out var owner)
                && !string.Equals(owner, exceptDeviceId, StringComparison.OrdinalIgnoreCase);
        }
    }
    //-----------//

    // Looks a sensor up by its hardware address in constant time, through the MAC index.
    public bool TryGetByMac(string mac, out SensorRegistration? sensor)
    {
        lock (_lock)
        {
            if (_byMac.TryGetValue(mac, out var deviceId))
                return _sensors.TryGetValue(deviceId, out sensor);

            sensor = null;
            return false;
        }
    }
    //-----------//

    // Looks a sensor up by device ID in constant time.
    public bool TryGet(string deviceId, out SensorRegistration? sensor)
    {
        lock (_lock)
        {
            return _sensors.TryGetValue(deviceId, out sensor);
        }
    }
    //-----------//

    // A snapshot of every registered sensor, safe to enumerate while others register.
    public IReadOnlyList<SensorRegistration> All
    {
        get
        {
            lock (_lock)
            {
                return _sensors.Values.ToArray();
            }
        }
    }
}
