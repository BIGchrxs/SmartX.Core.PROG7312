using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// In-memory registry of sensors and the Smart-X deployment hierarchy, plus the
/// three typed jagged-array buffers that flush readings into List<T>. Registered
/// as a singleton so every request shares the same state.
/// </summary>
public class SensorRegistry
{
    private readonly Dictionary<string, SensorRegistration> _sensors = new();
    public DeviceNode Root { get; }
    public TelemetryBuffer<float> FloatBuffer { get; }
    public TelemetryBuffer<int> IntBuffer { get; }
    public TelemetryBuffer<bool> BoolBuffer { get; }

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

    public bool TryRegister(SensorRegistration sensor) => _sensors.TryAdd(sensor.DeviceId, sensor);

    public bool TryGet(string deviceId, out SensorRegistration? sensor) =>
        _sensors.TryGetValue(deviceId, out sensor);

    public IReadOnlyCollection<SensorRegistration> All => _sensors.Values;
}