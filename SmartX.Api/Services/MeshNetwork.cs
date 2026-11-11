using System.Diagnostics;
using SmartX.Api.Models;
using SmartX.Api.Structures;

namespace SmartX.Api.Services;

/// <summary>
/// The physical mesh network as a weighted, undirected graph. Vertices are ESP32 nodes (sensors,
/// repeaters and the gateway) and edges are the wireless links between them, weighted by the power
/// a packet costs on that hop.
///
/// The graph is held as an adjacency list rather than a matrix. A mesh is sparse, so a list stores
/// only the links that exist and lets a traversal walk one node's neighbours directly, instead of
/// scanning a row of mostly empty cells.
/// </summary>
public class MeshNetwork
{
    private readonly object _lock = new();
    private readonly Dictionary<string, MeshNode> _nodes = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, List<MeshLink>> _adjacency = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<MeshLink> _edges = new();
    private readonly HashSet<string> _offline = new(StringComparer.OrdinalIgnoreCase);

    public const string GatewayId = "GW-CORE-00";

    public MeshNetwork()
    {
        BuildStudioHqMesh();
    }

    // Lays out the Studio HQ mesh: one gateway, two repeaters and the six sensors from Parts 1 and 2.
    private void BuildStudioHqMesh()
    {
        // Laid out left to right by how far a zone sits from the gateway: Material Storage, the hall
        // repeater, the gateway and IT Closet, then the mezzanine repeater and the far zones. The
        // canvas is wide rather than square so the whole mesh fits on screen without scrolling.
        AddNode(new MeshNode(GatewayId, "24:6F:28:00:00:01", "IT Closet", MeshNodeKind.Gateway, 52, 18, true));
        AddNode(new MeshNode("RPT-HALL-01", "24:6F:28:B2:5C:01", "Hallway", MeshNodeKind.Repeater, 26, 21, true));
        AddNode(new MeshNode("RPT-MEZZ-02", "24:6F:28:B2:5C:02", "Mezzanine", MeshNodeKind.Repeater, 74, 28, true));
        AddNode(new MeshNode("ITC-TEMP-01", "24:6F:28:A1:4B:01", "IT Closet", MeshNodeKind.Sensor, 65, 9, true));
        AddNode(new MeshNode("ITC-CRAC-01", "24:6F:28:A1:4B:02", "IT Closet", MeshNodeKind.Sensor, 42, 9, true));
        AddNode(new MeshNode("MS-HUM-01", "24:6F:28:C3:6D:01", "Material Storage", MeshNodeKind.Sensor, 9, 13, true));
        AddNode(new MeshNode("MS-DEHUM-01", "24:6F:28:C3:6D:02", "Material Storage", MeshNodeKind.Sensor, 12, 38, true));
        AddNode(new MeshNode("SR-LUX-01", "24:6F:28:D4:7E:01", "Showroom Floor", MeshNodeKind.Sensor, 92, 37, true));
        AddNode(new MeshNode("WS-PWR-01", "24:6F:28:E5:8F:01", "Workshop", MeshNodeKind.Sensor, 54, 40, true));

        AddLink(GatewayId, "ITC-TEMP-01", 2);
        AddLink(GatewayId, "ITC-CRAC-01", 3);
        AddLink(GatewayId, "RPT-HALL-01", 4);
        AddLink(GatewayId, "RPT-MEZZ-02", 6);
        AddLink("ITC-TEMP-01", "ITC-CRAC-01", 2);
        AddLink("ITC-CRAC-01", "RPT-HALL-01", 3);
        AddLink("RPT-HALL-01", "MS-HUM-01", 3);
        AddLink("RPT-HALL-01", "MS-DEHUM-01", 5);
        AddLink("MS-HUM-01", "MS-DEHUM-01", 2);
        AddLink("RPT-HALL-01", "RPT-MEZZ-02", 7);
        AddLink("RPT-MEZZ-02", "SR-LUX-01", 3);
        AddLink("RPT-MEZZ-02", "WS-PWR-01", 4);
        AddLink("SR-LUX-01", "WS-PWR-01", 5);
        AddLink("MS-DEHUM-01", "WS-PWR-01", 8);
    }
    //-----------//

    // Puts a vertex in the graph and gives it an empty neighbour list.
    private void AddNode(MeshNode node)
    {
        _nodes[node.Id] = node;
        if (!_adjacency.ContainsKey(node.Id))
            _adjacency[node.Id] = new List<MeshLink>();
    }
    //-----------//

    // Joins two nodes. The link is stored on both sides, because a wireless hop works in both directions.
    private void AddLink(string from, string to, int cost)
    {
        if (!_nodes.ContainsKey(from) || !_nodes.ContainsKey(to))
            return;

        if (_edges.Any(e => Joins(e, from, to)))
            return;

        _edges.Add(new MeshLink(from, to, cost));
        _adjacency[from].Add(new MeshLink(from, to, cost));
        _adjacency[to].Add(new MeshLink(to, from, cost));
    }
    //-----------//

    // True when an edge connects exactly these two nodes, in either direction.
    private static bool Joins(MeshLink edge, string a, string b)
    {
        return (string.Equals(edge.From, a, StringComparison.OrdinalIgnoreCase) && string.Equals(edge.To, b, StringComparison.OrdinalIgnoreCase))
            || (string.Equals(edge.From, b, StringComparison.OrdinalIgnoreCase) && string.Equals(edge.To, a, StringComparison.OrdinalIgnoreCase));
    }
    //-----------//

    /// <summary>
    /// Attaches a newly registered sensor to the mesh. It links to the nearest anchor in its own zone,
    /// so a device registered on the Ingestion page appears in the topology straight away.
    /// </summary>
    public void EnsureSensor(string deviceId, string mac, string zone)
    {
        lock (_lock)
        {
            if (_nodes.ContainsKey(deviceId))
                return;

            var anchor = _nodes.Values
                .Where(n => n.Kind != MeshNodeKind.Sensor)
                .OrderByDescending(n => string.Equals(n.Zone, zone, StringComparison.OrdinalIgnoreCase))
                .ThenBy(n => n.Kind == MeshNodeKind.Gateway ? 1 : 0)
                .First();

            // New sensors are placed just below their anchor, fanned out so labels do not collide.
            var offset = (_nodes.Count % 5) * 7 - 14;
            AddNode(new MeshNode(
                deviceId,
                mac,
                zone,
                MeshNodeKind.Sensor,
                Math.Clamp(anchor.X + offset, 6, 94),
                Math.Clamp(anchor.Y + 12, 8, 44),
                true));

            AddLink(anchor.Id, deviceId, 5);
        }
    }
    //-----------//

    // Every node in the mesh, with its current online state.
    public IReadOnlyList<MeshNode> Nodes()
    {
        lock (_lock)
        {
            return _nodes.Values
                .Select(n => n with { Online = !_offline.Contains(n.Id) })
                .OrderBy(n => n.Kind)
                .ThenBy(n => n.Id)
                .ToList();
        }
    }
    //-----------//

    // Every wireless link in the mesh, whether or not both ends are powered.
    public IReadOnlyList<MeshLink> Links()
    {
        lock (_lock)
        {
            return _edges.ToList();
        }
    }
    //-----------//

    // The hardware address the topology already holds for a node, or nothing when it is new to the mesh.
    public string? MacFor(string deviceId)
    {
        lock (_lock)
        {
            return _nodes.TryGetValue(deviceId, out var node) ? node.Mac : null;
        }
    }
    //-----------//

    // Looks a node up by ID or by MAC address, so the dashboard can accept either.
    public MeshNode? Find(string idOrMac)
    {
        lock (_lock)
        {
            if (_nodes.TryGetValue(idOrMac, out var byId))
                return byId with { Online = !_offline.Contains(byId.Id) };

            var byMac = _nodes.Values.FirstOrDefault(n => string.Equals(n.Mac, idOrMac, StringComparison.OrdinalIgnoreCase));
            return byMac is null ? null : byMac with { Online = !_offline.Contains(byMac.Id) };
        }
    }
    //-----------//

    // Powers a node down or back up, so a failure and the self healing that follows can be demonstrated.
    public bool SetOnline(string id, bool online)
    {
        lock (_lock)
        {
            if (!_nodes.ContainsKey(id))
                return false;

            if (string.Equals(id, GatewayId, StringComparison.OrdinalIgnoreCase))
                return false;

            if (online)
                _offline.Remove(id);
            else
                _offline.Add(id);

            return true;
        }
    }
    //-----------//

    // Brings every node back online.
    public void ResetOutages()
    {
        lock (_lock)
        {
            _offline.Clear();
        }
    }
    //-----------//

    /// <summary>
    /// Breadth first search out from one node. It visits the whole of one hop distance before moving
    /// to the next, so the order it produces is also the order of fewest hops from the start. Anything
    /// it never reaches has been cut off by a failed node.
    /// </summary>
    public TraversalResult Bfs(string startId)
    {
        lock (_lock)
        {
            var order = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var queue = new Queue<string>();
            var examined = 0;

            if (IsUsable(startId))
            {
                queue.Enqueue(startId);
                seen.Add(startId);
            }

            while (queue.Count > 0)
            {
                var current = queue.Dequeue();
                order.Add(current);

                foreach (var link in _adjacency[current].OrderBy(l => l.Cost).ThenBy(l => l.To))
                {
                    examined++;
                    if (!IsUsable(link.To) || !seen.Add(link.To))
                        continue;

                    queue.Enqueue(link.To);
                }
            }

            return BuildTraversal("Breadth first search", startId, order, seen, examined);
        }
    }
    //-----------//

    /// <summary>
    /// Depth first search out from one node. It follows one branch of the mesh as far as it goes
    /// before backing up, which is the cheaper walk when the question is only whether a node can be
    /// reached at all.
    /// </summary>
    public TraversalResult Dfs(string startId)
    {
        lock (_lock)
        {
            var order = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var stack = new Stack<string>();
            var examined = 0;

            if (IsUsable(startId))
                stack.Push(startId);

            while (stack.Count > 0)
            {
                var current = stack.Pop();

                if (!seen.Add(current))
                    continue;

                order.Add(current);

                // Pushed in reverse, so the cheapest link is popped first and the walk is repeatable.
                foreach (var link in _adjacency[current].OrderByDescending(l => l.Cost).ThenByDescending(l => l.To))
                {
                    examined++;
                    if (IsUsable(link.To) && !seen.Contains(link.To))
                        stack.Push(link.To);
                }
            }

            return BuildTraversal("Depth first search", startId, order, seen, examined);
        }
    }
    //-----------//

    // Splits the nodes into reached, cut off and powered down, which is what the dashboard reports.
    private TraversalResult BuildTraversal(string algorithm, string startId, List<string> order, HashSet<string> seen, int examined)
    {
        var offline = _nodes.Keys.Where(id => _offline.Contains(id)).OrderBy(id => id).ToList();
        var unreachable = _nodes.Keys
            .Where(id => !_offline.Contains(id) && !seen.Contains(id))
            .OrderBy(id => id)
            .ToList();

        return new TraversalResult(algorithm, startId, order, order.ToList(), unreachable, offline, examined);
    }
    //-----------//

    // A node counts for routing only when it exists and has power.
    private bool IsUsable(string id) => _nodes.ContainsKey(id) && !_offline.Contains(id);
    //-----------//

    /// <summary>
    /// Prim's algorithm. It grows one tree outwards from the gateway, each time taking the cheapest
    /// link that reaches a node not yet in the tree. A binary min heap holds the candidate links, so
    /// the cheapest one is always on top and no scan of the edge list is needed.
    /// </summary>
    public MstResult PrimMst()
    {
        lock (_lock)
        {
            var clock = Stopwatch.StartNew();
            var chosen = new List<MeshLink>();
            var inTree = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var operations = 0;

            // The heap is keyed by cost, so Dequeue always returns the cheapest link still on offer.
            var frontier = new PriorityQueue<MeshLink, int>();

            if (!IsUsable(GatewayId))
                return new MstResult("Prim (binary min heap)", chosen, 0, 0, false, clock.ElapsedTicks, operations);

            inTree.Add(GatewayId);

            foreach (var link in _adjacency[GatewayId])
            {
                if (IsUsable(link.To))
                {
                    frontier.Enqueue(link, link.Cost);
                    operations++;
                }
            }

            while (frontier.Count > 0)
            {
                var cheapest = frontier.Dequeue();
                operations++;

                // Both ends already in the tree means this link would close a cycle.
                if (!inTree.Add(cheapest.To))
                    continue;

                chosen.Add(cheapest);

                foreach (var next in _adjacency[cheapest.To])
                {
                    if (IsUsable(next.To) && !inTree.Contains(next.To))
                    {
                        frontier.Enqueue(next, next.Cost);
                        operations++;
                    }
                }
            }

            clock.Stop();
            var live = _nodes.Keys.Count(IsUsable);

            return new MstResult(
                "Prim (binary min heap)",
                chosen,
                chosen.Sum(e => e.Cost),
                inTree.Count,
                inTree.Count == live,
                clock.ElapsedTicks,
                operations);
        }
    }
    //-----------//

    /// <summary>
    /// Kruskal's algorithm. It sorts every link by cost and takes each one that joins two parts of
    /// the network that were not already connected, which union find answers in near constant time.
    /// It reaches the same total cost as Prim's, which is a useful check that both are correct.
    /// </summary>
    public MstResult KruskalMst()
    {
        lock (_lock)
        {
            var clock = Stopwatch.StartNew();
            var chosen = new List<MeshLink>();
            var sets = new DisjointSet();
            var operations = 0;

            foreach (var id in _nodes.Keys.Where(IsUsable))
                sets.Add(id);

            var usable = _edges
                .Where(e => IsUsable(e.From) && IsUsable(e.To))
                .OrderBy(e => e.Cost)
                .ThenBy(e => e.From)
                .ThenBy(e => e.To);

            foreach (var edge in usable)
            {
                operations++;

                // Union returns false when both ends share a set already, which would make a cycle.
                if (sets.Union(edge.From, edge.To))
                    chosen.Add(edge);
            }

            clock.Stop();
            var live = _nodes.Keys.Count(IsUsable);
            var spanned = chosen.Count == 0 ? (live > 0 ? 1 : 0) : chosen.Count + 1;

            return new MstResult(
                "Kruskal (union find)",
                chosen,
                chosen.Sum(e => e.Cost),
                spanned,
                spanned == live,
                clock.ElapsedTicks,
                operations);
        }
    }
    //-----------//

    /// <summary>
    /// The route a node's telemetry takes back to the gateway along the minimum spanning tree. The
    /// tree holds one path between any two nodes, so this is the route the mesh would use if every
    /// node kept only its spanning tree links powered up.
    /// </summary>
    public MeshPath RouteThroughMst(string nodeId)
    {
        lock (_lock)
        {
            var mst = PrimMst();
            var tree = new Dictionary<string, List<MeshLink>>(StringComparer.OrdinalIgnoreCase);

            foreach (var edge in mst.Edges)
            {
                if (!tree.TryGetValue(edge.From, out var fromList))
                    tree[edge.From] = fromList = new List<MeshLink>();
                if (!tree.TryGetValue(edge.To, out var toList))
                    tree[edge.To] = toList = new List<MeshLink>();

                fromList.Add(edge);
                toList.Add(new MeshLink(edge.To, edge.From, edge.Cost));
            }

            return WalkToGateway(nodeId, tree, "Minimum spanning tree hop path");
        }
    }
    //-----------//

    /// <summary>
    /// Dijkstra's algorithm over the full mesh, giving the cheapest route one node can take on its
    /// own. It can beat the spanning tree route, because the tree minimises the power of the whole
    /// network rather than of any single node.
    /// </summary>
    public MeshPath CheapestRoute(string nodeId)
    {
        lock (_lock)
        {
            if (!IsUsable(nodeId))
                return Unreachable(nodeId, "Dijkstra cheapest path");

            var best = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase) { [nodeId] = 0 };
            var cameFrom = new Dictionary<string, MeshLink>(StringComparer.OrdinalIgnoreCase);
            var settled = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var frontier = new PriorityQueue<string, int>();

            frontier.Enqueue(nodeId, 0);

            while (frontier.Count > 0)
            {
                var current = frontier.Dequeue();

                if (!settled.Add(current))
                    continue;

                if (string.Equals(current, GatewayId, StringComparison.OrdinalIgnoreCase))
                    break;

                foreach (var link in _adjacency[current])
                {
                    if (!IsUsable(link.To))
                        continue;

                    var cost = best[current] + link.Cost;

                    if (!best.TryGetValue(link.To, out var known) || cost < known)
                    {
                        best[link.To] = cost;
                        cameFrom[link.To] = link;
                        frontier.Enqueue(link.To, cost);
                    }
                }
            }

            if (!best.ContainsKey(GatewayId))
                return Unreachable(nodeId, "Dijkstra cheapest path");

            var legs = new List<MeshLink>();
            var walk = GatewayId;

            while (cameFrom.TryGetValue(walk, out var leg))
            {
                legs.Insert(0, leg);
                walk = leg.From;
            }

            var hops = new List<string> { nodeId };
            hops.AddRange(legs.Select(l => l.To));

            return new MeshPath(nodeId, GatewayId, true, hops, legs, legs.Sum(l => l.Cost), "Dijkstra cheapest path");
        }
    }
    //-----------//

    // Walks a tree from one node back to the gateway, which is a plain breadth first search over tree links.
    private MeshPath WalkToGateway(string nodeId, Dictionary<string, List<MeshLink>> tree, string method)
    {
        if (!IsUsable(nodeId) || !tree.ContainsKey(nodeId))
        {
            return string.Equals(nodeId, GatewayId, StringComparison.OrdinalIgnoreCase) && IsUsable(nodeId)
                ? new MeshPath(nodeId, GatewayId, true, new List<string> { nodeId }, new List<MeshLink>(), 0, method)
                : Unreachable(nodeId, method);
        }

        var cameFrom = new Dictionary<string, MeshLink>(StringComparer.OrdinalIgnoreCase);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { nodeId };
        var queue = new Queue<string>();
        queue.Enqueue(nodeId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();

            if (string.Equals(current, GatewayId, StringComparison.OrdinalIgnoreCase))
                break;

            foreach (var link in tree[current])
            {
                if (!seen.Add(link.To))
                    continue;

                cameFrom[link.To] = link;
                queue.Enqueue(link.To);
            }
        }

        if (!cameFrom.ContainsKey(GatewayId))
            return Unreachable(nodeId, method);

        var legs = new List<MeshLink>();
        var walk = GatewayId;

        while (cameFrom.TryGetValue(walk, out var leg))
        {
            legs.Insert(0, leg);
            walk = leg.From;
        }

        var hops = new List<string> { nodeId };
        hops.AddRange(legs.Select(l => l.To));

        return new MeshPath(nodeId, GatewayId, true, hops, legs, legs.Sum(l => l.Cost), method);
    }
    //-----------//

    // The answer when no route exists, for example because a repeater in the way has lost power.
    private static MeshPath Unreachable(string nodeId, string method) =>
        new(nodeId, GatewayId, false, Array.Empty<string>(), Array.Empty<MeshLink>(), 0, method);
    //-----------//
}
