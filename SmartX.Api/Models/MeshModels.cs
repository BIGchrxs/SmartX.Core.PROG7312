namespace SmartX.Api.Models;

/// <summary>What a node does in the mesh. Only sensors report telemetry.</summary>
public enum MeshNodeKind
{
    Gateway,
    Repeater,
    Sensor
}

/// <summary>
/// One vertex of the mesh graph: an ESP32 sensor, a repeater, or the gateway that everything
/// routes back to. X and Y are layout coordinates on a 0 to 100 grid, so the dashboard can draw
/// the network without recomputing a layout.
/// </summary>
public sealed record MeshNode(
    string Id,
    string Mac,
    string Zone,
    MeshNodeKind Kind,
    double X,
    double Y,
    bool Online);

/// <summary>
/// One wireless link between two nodes. Cost is the power needed to push a packet across that hop,
/// so a cheaper edge means a longer battery life for the node that uses it.
/// </summary>
public sealed record MeshLink(string From, string To, int Cost);

/// <summary>A route from one node back to the gateway, hop by hop.</summary>
public sealed record MeshPath(
    string FromId,
    string ToId,
    bool Reachable,
    IReadOnlyList<string> Hops,
    IReadOnlyList<MeshLink> Legs,
    int TotalCost,
    string Method);

/// <summary>The result of a breadth first or depth first walk out from one node.</summary>
public sealed record TraversalResult(
    string Algorithm,
    string StartId,
    IReadOnlyList<string> Order,
    IReadOnlyList<string> Reachable,
    IReadOnlyList<string> Unreachable,
    IReadOnlyList<string> Offline,
    int EdgesExamined);

/// <summary>A minimum spanning tree, with the cost of building it and how long the algorithm took.</summary>
public sealed record MstResult(
    string Algorithm,
    IReadOnlyList<MeshLink> Edges,
    int TotalCost,
    int NodesSpanned,
    bool SpansWholeNetwork,
    long ElapsedTicks,
    int QueueOperations);

/// <summary>What a range query over the archive cost, next to the same answer found by a plain scan.</summary>
public sealed record RangeQueryReport(
    string DeviceId,
    DateTime From,
    DateTime To,
    int Matches,
    int ArchivedReadings,
    int TreeHeight,
    int IdealHeight,
    long Rotations,
    int TreeNodesVisited,
    int ListItemsScanned,
    long TreeTicks,
    long ListTicks,
    bool AnswersMatch);
