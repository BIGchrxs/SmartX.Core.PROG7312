namespace SmartX.Api.Structures;

/// <summary>
/// A self balancing binary search tree (AVL). Every node keeps the height of its subtree, and any
/// insert that leaves a node more than one level out of balance is corrected by a rotation. That
/// keeps the height at roughly log2(n), so a lookup or a range query over a long telemetry history
/// touches only a handful of nodes instead of walking the whole list.
///
/// The tree is generic, so the same structure stores readings keyed by timestamp here and could key
/// by anything comparable elsewhere, with no boxing of the key or the value.
/// </summary>
public class AvlTree<TKey, TValue> where TKey : IComparable<TKey>
{
    // One node of the tree. Height is stored rather than computed, so balancing stays O(1) per node.
    private sealed class Node
    {
        public Node(TKey key, TValue value)
        {
            Key = key;
            Value = value;
            Height = 1;
        }

        public TKey Key;
        public TValue Value;
        public Node? Left;
        public Node? Right;
        public int Height;
    }

    private Node? _root;
    private int _count;
    private long _rotations;

    // How many readings the tree holds.
    public int Count => _count;
    //-----------//

    // The height of the tree. For a balanced tree this stays near log2(Count).
    public int Height => HeightOf(_root);
    //-----------//

    // How many rotations have been performed. Proof that the tree rebalanced itself as it grew.
    public long Rotations => _rotations;
    //-----------//

    // The height a perfectly balanced tree of this size would have. Used to show how close to ideal the tree is.
    public int IdealHeight => _count == 0 ? 0 : (int)Math.Floor(Math.Log2(_count)) + 1;
    //-----------//

    // Adds a reading. An existing key is overwritten, so a repeated timestamp never corrupts the ordering.
    public void Insert(TKey key, TValue value)
    {
        _root = InsertInto(_root, key, value);
    }
    //-----------//

    // Recursive insert that rebalances every node on the way back up.
    private Node InsertInto(Node? node, TKey key, TValue value)
    {
        if (node is null)
        {
            _count++;
            return new Node(key, value);
        }

        var order = key.CompareTo(node.Key);

        if (order < 0)
            node.Left = InsertInto(node.Left, key, value);
        else if (order > 0)
            node.Right = InsertInto(node.Right, key, value);
        else
        {
            node.Value = value;
            return node;
        }

        return Rebalance(node);
    }
    //-----------//

    // How many comparisons it takes to find one key, which is how deep that key sits in the tree.
    public int ComparisonsToFind(TKey key)
    {
        var node = _root;
        var steps = 0;

        while (node is not null)
        {
            steps++;
            var order = key.CompareTo(node.Key);

            if (order == 0)
                return steps;

            node = order < 0 ? node.Left : node.Right;
        }

        return steps;
    }
    //-----------//

    // Finds one reading by its exact key.
    public bool TryGet(TKey key, out TValue? value)
    {
        var node = _root;

        while (node is not null)
        {
            var order = key.CompareTo(node.Key);
            if (order == 0)
            {
                value = node.Value;
                return true;
            }

            node = order < 0 ? node.Left : node.Right;
        }

        value = default;
        return false;
    }
    //-----------//

    /// <summary>
    /// Every value whose key falls between from and to, in ascending key order. Branches that cannot
    /// contain a match are skipped entirely, so the work is proportional to the size of the answer
    /// plus the height of the tree, not to the size of the history.
    /// </summary>
    public IReadOnlyList<TValue> Range(TKey from, TKey to, out int nodesVisited)
    {
        var results = new List<TValue>();
        var visited = 0;
        CollectRange(_root, from, to, results, ref visited);
        nodesVisited = visited;
        return results;
    }
    //-----------//

    // Walks only the branches that can hold keys inside the range.
    private static void CollectRange(Node? node, TKey from, TKey to, List<TValue> results, ref int visited)
    {
        if (node is null)
            return;

        visited++;

        var afterFrom = node.Key.CompareTo(from);
        var beforeTo = node.Key.CompareTo(to);

        // Only look left when this node is already past the start of the range.
        if (afterFrom > 0)
            CollectRange(node.Left, from, to, results, ref visited);

        if (afterFrom >= 0 && beforeTo <= 0)
            results.Add(node.Value);

        // Only look right when this node is still before the end of the range.
        if (beforeTo < 0)
            CollectRange(node.Right, from, to, results, ref visited);
    }
    //-----------//

    // Every value in ascending key order, newest "limit" entries when a limit is given.
    public IReadOnlyList<TValue> InOrder(int limit = 0)
    {
        var results = new List<TValue>();
        CollectAll(_root, results);
        return limit > 0 && results.Count > limit
            ? results.GetRange(results.Count - limit, limit)
            : results;
    }
    //-----------//

    // Standard in order walk, left then node then right.
    private static void CollectAll(Node? node, List<TValue> results)
    {
        if (node is null)
            return;

        CollectAll(node.Left, results);
        results.Add(node.Value);
        CollectAll(node.Right, results);
    }
    //-----------//

    // The smallest key held, or nothing when the tree is empty.
    public TKey? MinKey()
    {
        var node = _root;
        if (node is null)
            return default;

        while (node.Left is not null)
            node = node.Left;

        return node.Key;
    }
    //-----------//

    // The largest key held, or nothing when the tree is empty.
    public TKey? MaxKey()
    {
        var node = _root;
        if (node is null)
            return default;

        while (node.Right is not null)
            node = node.Right;

        return node.Key;
    }
    //-----------//

    // Checks that no node is more than one level out of balance. Used by the self test.
    public bool IsBalanced() => CheckBalance(_root);
    //-----------//

    // Recursive balance check for the whole subtree.
    private static bool CheckBalance(Node? node)
    {
        if (node is null)
            return true;

        return Math.Abs(BalanceOf(node)) <= 1 && CheckBalance(node.Left) && CheckBalance(node.Right);
    }
    //-----------//

    // Restores the height of a node and rotates it when it has tipped too far to one side.
    private Node Rebalance(Node node)
    {
        Reheight(node);
        var balance = BalanceOf(node);

        // Left heavy.
        if (balance > 1)
        {
            // Left right case: straighten the child first, then rotate the node.
            if (BalanceOf(node.Left!) < 0)
                node.Left = RotateLeft(node.Left!);

            return RotateRight(node);
        }

        // Right heavy.
        if (balance < -1)
        {
            // Right left case: straighten the child first, then rotate the node.
            if (BalanceOf(node.Right!) > 0)
                node.Right = RotateRight(node.Right!);

            return RotateLeft(node);
        }

        return node;
    }
    //-----------//

    // Rotates a right heavy node to the left, lifting its right child into its place.
    private Node RotateLeft(Node node)
    {
        var lifted = node.Right!;
        node.Right = lifted.Left;
        lifted.Left = node;

        Reheight(node);
        Reheight(lifted);
        _rotations++;

        return lifted;
    }
    //-----------//

    // Rotates a left heavy node to the right, lifting its left child into its place.
    private Node RotateRight(Node node)
    {
        var lifted = node.Left!;
        node.Left = lifted.Right;
        lifted.Right = node;

        Reheight(node);
        Reheight(lifted);
        _rotations++;

        return lifted;
    }
    //-----------//

    // Recalculates one node's height from its children.
    private static void Reheight(Node node)
    {
        node.Height = 1 + Math.Max(HeightOf(node.Left), HeightOf(node.Right));
    }
    //-----------//

    // How much taller the left side is than the right. Anything outside -1 to 1 needs a rotation.
    private static int BalanceOf(Node node) => HeightOf(node.Left) - HeightOf(node.Right);
    //-----------//

    // The stored height of a node, counting an empty branch as zero.
    private static int HeightOf(Node? node) => node?.Height ?? 0;
    //-----------//
}
