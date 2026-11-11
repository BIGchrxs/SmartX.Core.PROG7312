namespace SmartX.Api.Structures;

/// <summary>
/// Union find, the structure Kruskal's algorithm uses to answer "are these two nodes already joined?"
/// Each node starts in its own set. Union merges two sets, Find names the set a node belongs to.
/// Path compression flattens the chain on every lookup and union by rank keeps the shallower tree
/// underneath, so both operations run in near constant time.
/// </summary>
public class DisjointSet
{
    private readonly Dictionary<string, string> _parent = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, int> _rank = new(StringComparer.OrdinalIgnoreCase);

    // Puts a node in a set of its own, ready to be merged later.
    public void Add(string id)
    {
        if (_parent.ContainsKey(id))
            return;

        _parent[id] = id;
        _rank[id] = 0;
    }
    //-----------//

    // The representative of the set a node belongs to, flattening the path on the way.
    public string Find(string id)
    {
        Add(id);

        var root = id;
        while (!string.Equals(_parent[root], root, StringComparison.OrdinalIgnoreCase))
            root = _parent[root];

        // Path compression: point everything on the way at the root, so the next Find is immediate.
        var walk = id;
        while (!string.Equals(_parent[walk], root, StringComparison.OrdinalIgnoreCase))
        {
            var next = _parent[walk];
            _parent[walk] = root;
            walk = next;
        }

        return root;
    }
    //-----------//

    // Merges the two sets. Returns false when both nodes were already joined, which means a cycle.
    public bool Union(string left, string right)
    {
        var a = Find(left);
        var b = Find(right);

        if (string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
            return false;

        // Union by rank: hang the shallower tree off the deeper one so the depth grows slowly.
        if (_rank[a] < _rank[b])
            (a, b) = (b, a);

        _parent[b] = a;

        if (_rank[a] == _rank[b])
            _rank[a]++;

        return true;
    }
    //-----------//
}
