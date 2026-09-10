namespace SmartX.Core.PROG7312.Models;

public class DeviceNode
{
    public string Name { get; }
    public List<DeviceNode> Children { get; } = new();

    public DeviceNode(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Node name is required.", nameof(name));
        Name = name;
    }

    public DeviceNode AddChild(DeviceNode child)
    {
        Children.Add(child);
        return this;
    }

    private bool IsValidPath(Queue<string> remainingSegments)
    {

        if (remainingSegments.Count == 0 ||
            !string.Equals(remainingSegments.Peek(), Name, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        remainingSegments.Dequeue();

        if (remainingSegments.Count == 0)
            return true;

        foreach (var child in Children)
        {
            if (child.IsValidPath(new Queue<string>(remainingSegments)))
                return true;
        }

        return false;
    }

    public static bool ValidateDeploymentPath(DeviceNode root, string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return root.IsValidPath(new Queue<string>(segments));
    }
}
