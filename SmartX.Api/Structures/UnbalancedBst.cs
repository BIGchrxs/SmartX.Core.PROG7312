namespace SmartX.Api.Structures;

/// <summary>
/// A plain binary search tree with no balancing, kept purely so the dashboard can show what the
/// archive would look like without an AVL tree.
///
/// Telemetry arrives in time order, and a timestamp key that only ever increases is the worst case
/// for an unbalanced tree: every new reading goes down the right hand side, so the tree becomes a
/// linked list and a lookup degrades from O(log n) to O(n). That is the reason the archive uses a
/// self balancing tree rather than this one.
///
/// Insert and height are written as loops rather than recursion on purpose. A tree this lopsided
/// would be thousands of levels deep, and a recursive walk of it would overflow the stack.
/// </summary>
public class UnbalancedBst<TKey> where TKey : IComparable<TKey>
{
    private sealed class Node
    {
        public Node(TKey key) => Key = key;

        public readonly TKey Key;
        public Node? Left;
        public Node? Right;
    }

    private Node? _root;
    private int _count;

    // How many keys the tree holds.
    public int Count => _count;
    //-----------//

    // Adds a key, walking down from the root without recursion. A repeat is ignored.
    public void Insert(TKey key)
    {
        if (_root is null)
        {
            _root = new Node(key);
            _count++;
            return;
        }

        var node = _root;

        while (true)
        {
            var order = key.CompareTo(node.Key);

            if (order == 0)
                return;

            if (order < 0)
            {
                if (node.Left is null)
                {
                    node.Left = new Node(key);
                    _count++;
                    return;
                }

                node = node.Left;
            }
            else
            {
                if (node.Right is null)
                {
                    node.Right = new Node(key);
                    _count++;
                    return;
                }

                node = node.Right;
            }
        }
    }
    //-----------//

    // The depth of the deepest branch, measured with an explicit stack so a long tree cannot overflow.
    public int Height()
    {
        if (_root is null)
            return 0;

        var tallest = 0;
        var stack = new Stack<(Node Node, int Depth)>();
        stack.Push((_root, 1));

        while (stack.Count > 0)
        {
            var (node, depth) = stack.Pop();

            if (depth > tallest)
                tallest = depth;

            if (node.Left is not null)
                stack.Push((node.Left, depth + 1));

            if (node.Right is not null)
                stack.Push((node.Right, depth + 1));
        }

        return tallest;
    }
    //-----------//

    // How many comparisons it takes to find one key, which is how deep that key sits.
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
}
