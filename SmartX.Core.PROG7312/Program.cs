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
