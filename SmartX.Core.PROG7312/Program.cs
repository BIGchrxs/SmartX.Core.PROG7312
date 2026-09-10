using SmartX.Core.PROG7312.Models;

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

Console.WriteLine("== 1. Recursive deployment path validation ==");
Console.WriteLine($"Studio HQ/IT Closet/Server Rack A -> {DeviceNode.ValidateDeploymentPath(root, "Studio HQ/IT Closet/Server Rack A")}");
Console.WriteLine($"Studio HQ/Workshop/Paint Booth    -> {DeviceNode.ValidateDeploymentPath(root, "Studio HQ/Workshop/Paint Booth")}");

Console.WriteLine("\n== 2. TelemetryPacket<T> \u2014 one wrapper, three value types ==");
var rackTemp = new TelemetryPacket<float>("ITC-TEMP-01", "IT Closet", SensorCategory.Environmental, 28.4f);
var upsCharge = new TelemetryPacket<int>("ITC-UPS-01", "IT Closet", SensorCategory.Power, 96);
var cracState = new TelemetryPacket<bool>("ITC-CRAC-01", "IT Closet", SensorCategory.Actuator, false);

Console.WriteLine(rackTemp);
Console.WriteLine(upsCharge);
Console.WriteLine(cracState);

Console.WriteLine("\n== 3. Operator overloading \u2014 aggregate two workshop power meters ==");
var meter1 = new SensorReading("Workshop-Meter-1", 420.5);
var meter2 = new SensorReading("Workshop-Meter-2", 315.2);
var meter3 = meter1 + meter2;
Console.WriteLine($"Meter1 ({meter1.Value:F1}W) + Meter2 ({meter2.Value:F1}W) = Meter3 ({meter3.Value:F1}W)");

Console.WriteLine("\n== 4. Closed-loop automation \u2014 rack temperature drives the CRAC unit ==");
const double CracThreshold = 27.0;
var rackReading = new SensorReading(rackTemp.DeviceId, rackTemp.Value);
bool coolingShouldRun = rackReading > CracThreshold;

var updatedCracState = new TelemetryPacket<bool>(cracState.DeviceId, cracState.Zone, cracState.Category, coolingShouldRun);
Console.WriteLine($"Rack inlet temp {rackTemp.Value}\u00b0C {(coolingShouldRun ? ">" : "<=")} {CracThreshold}\u00b0C threshold -> CRAC state: {updatedCracState.Value}");

Console.WriteLine("\n== 5. Jagged array buffer -> optimised List<T> ==");
var buffer = new TelemetryBuffer<float>(
    ("Showroom Floor", 3),
    ("Material Storage", 2),
    ("Workshop", 4),
    ("IT Closet", 2));

buffer.Add(new TelemetryPacket<float>("SR-LUX-01", "Showroom Floor", SensorCategory.Environmental, 340.2f));
buffer.Add(new TelemetryPacket<float>("MS-TEMP-01", "Material Storage", SensorCategory.Environmental, 18.9f));
buffer.Add(new TelemetryPacket<float>("MS-TEMP-01", "Material Storage", SensorCategory.Environmental, 19.1f)); // fills Material Storage's row (capacity 2) -> auto-flushes
buffer.Add(new TelemetryPacket<float>("ITC-TEMP-01", "IT Closet", SensorCategory.Environmental, rackTemp.Value));
buffer.Add(new TelemetryPacket<float>("ITC-TEMP-01", "IT Closet", SensorCategory.Environmental, 29.0f)); // fills IT Closet's row (capacity 2) -> auto-flushes

Console.WriteLine($"Readings flushed into the List<T> so far: {buffer.Flushed.Count}");
foreach (var reading in buffer.Flushed)
    Console.WriteLine($"  {reading}");
Console.WriteLine("(Showroom Floor's reading is still sitting in its jagged row, waiting for 2 more before it flushes.)");