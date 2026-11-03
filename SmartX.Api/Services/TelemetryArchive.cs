using System.Diagnostics;
using SmartX.Api.Models;
using SmartX.Api.Structures;

namespace SmartX.Api.Services;

/// <summary>
/// The long term telemetry store. Every device gets its own AVL tree keyed by timestamp, so a
/// question like "every reading between 14:00 and 16:00 for this node" is answered by walking down
/// to the start of the range and reading across, rather than by scanning the whole history.
///
/// Part 2's sorted dictionary feeds the live timeline and keeps only the newest 500 readings. This
/// archive is the deep history behind it, and it holds far more, which is exactly where the
/// difference between a tree and a plain list starts to show.
///
/// An unsorted copy of the same readings is kept beside each tree for one reason only: so the
/// dashboard can run both the tree query and a plain scan on identical data and show the gap.
/// </summary>
public class TelemetryArchive
{
    private readonly object _lock = new();
    private readonly Dictionary<string, AvlTree<DateTime, HistoryPoint>> _trees = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, List<HistoryPoint>> _unsorted = new(StringComparer.OrdinalIgnoreCase);

    // Files one reading under its device. A repeated timestamp is nudged on so no reading is lost.
    public void Add(string deviceId, HistoryPoint point)
    {
        lock (_lock)
        {
            var tree = TreeFor(deviceId);
            var key = point.Timestamp;

            while (tree.TryGet(key, out _))
                key = key.AddTicks(1);

            tree.Insert(key, point with { Timestamp = key });
            _unsorted[deviceId].Add(point with { Timestamp = key });
        }
    }
    //-----------//

    // The tree for a device, created on first use.
    private AvlTree<DateTime, HistoryPoint> TreeFor(string deviceId)
    {
        if (!_trees.TryGetValue(deviceId, out var tree))
        {
            tree = new AvlTree<DateTime, HistoryPoint>();
            _trees[deviceId] = tree;
            _unsorted[deviceId] = new List<HistoryPoint>();
        }

        return tree;
    }
    //-----------//

    /// <summary>
    /// Runs the same range query twice: once down the AVL tree and once as a scan of an unsorted
    /// list. Both answers are compared, and the report carries how much work each one did, which is
    /// what the dashboard shows.
    /// </summary>
    public (IReadOnlyList<HistoryPoint> Points, RangeQueryReport Report) RangeQuery(string deviceId, DateTime from, DateTime to)
    {
        lock (_lock)
        {
            if (!_trees.TryGetValue(deviceId, out var tree))
            {
                var empty = new RangeQueryReport(deviceId, from, to, 0, 0, 0, 0, 0, 0, 0, 0, 0, true);
                return (Array.Empty<HistoryPoint>(), empty);
            }

            var list = _unsorted[deviceId];

            // The tree walk: skip any branch that cannot hold a key inside the range.
            var treeClock = Stopwatch.StartNew();
            var fromTree = tree.Range(from, to, out var nodesVisited);
            treeClock.Stop();

            // The plain scan: every reading has to be looked at, because nothing is in order.
            var listClock = Stopwatch.StartNew();
            var fromList = new List<HistoryPoint>();
            var scanned = 0;

            foreach (var point in list)
            {
                scanned++;
                if (point.Timestamp >= from && point.Timestamp <= to)
                    fromList.Add(point);
            }

            listClock.Stop();

            var report = new RangeQueryReport(
                deviceId,
                from,
                to,
                fromTree.Count,
                tree.Count,
                tree.Height,
                tree.IdealHeight,
                tree.Rotations,
                nodesVisited,
                scanned,
                treeClock.ElapsedTicks,
                listClock.ElapsedTicks,
                fromTree.Count == fromList.Count);

            return (fromTree, report);
        }
    }
    //-----------//

    // The newest readings for a device in time order, which is the historical log the dashboard shows.
    public IReadOnlyList<HistoryPoint> Recent(string deviceId, int limit)
    {
        lock (_lock)
        {
            return _trees.TryGetValue(deviceId, out var tree)
                ? tree.InOrder(limit)
                : Array.Empty<HistoryPoint>();
        }
    }
    //-----------//

    // How big and how balanced a device's tree is, and the span of time it covers.
    public object Stats(string deviceId)
    {
        lock (_lock)
        {
            if (!_trees.TryGetValue(deviceId, out var tree))
                return new { deviceId, archived = 0, height = 0, idealHeight = 0, rotations = 0L, balanced = true, oldest = (DateTime?)null, newest = (DateTime?)null };

            return new
            {
                deviceId,
                archived = tree.Count,
                height = tree.Height,
                idealHeight = tree.IdealHeight,
                rotations = tree.Rotations,
                balanced = tree.IsBalanced(),
                oldest = tree.Count == 0 ? (DateTime?)null : tree.MinKey(),
                newest = tree.Count == 0 ? (DateTime?)null : tree.MaxKey()
            };
        }
    }
    //-----------//

    // Every device that has archived readings.
    public IReadOnlyList<string> Devices()
    {
        lock (_lock)
        {
            return _trees.Keys.OrderBy(k => k).ToArray();
        }
    }
    //-----------//

    /// <summary>
    /// Fills a device's archive with back dated readings, so the tree can be shown working over a
    /// history far longer than a live demo could produce. Values follow a daily cycle around the
    /// level given, so a range query returns something that looks like real telemetry.
    /// </summary>
    public int Backfill(string deviceId, int readings, double level, double swing, TimeSpan spacing)
    {
        var random = new Random(deviceId.GetHashCode() & 0x7FFFFFFF);
        var start = DateTime.UtcNow - TimeSpan.FromTicks(spacing.Ticks * readings);

        for (var i = 0; i < readings; i++)
        {
            var at = start + TimeSpan.FromTicks(spacing.Ticks * i);
            var hourOfDay = at.TimeOfDay.TotalHours;
            var cycle = Math.Sin(hourOfDay / 24.0 * 2 * Math.PI);
            var value = Math.Round(level + cycle * swing + (random.NextDouble() - 0.5) * swing * 0.4, 2);

            Add(deviceId, new HistoryPoint(at, value, ReadingSeverity.Normal));
        }

        return readings;
    }
    //-----------//

    /// <summary>
    /// Builds a plain, unbalanced search tree from the same readings and reports how deep each one
    /// gets. Timestamps only ever increase, so the unbalanced tree degrades into a linked list while
    /// the AVL tree stays near log2(n). This is the measurement behind the choice of structure.
    /// </summary>
    public object BalanceProof(string deviceId, int sample)
    {
        lock (_lock)
        {
            if (!_trees.TryGetValue(deviceId, out var tree) || tree.Count == 0)
                return new { deviceId, sampled = 0, avlHeight = 0, unbalancedHeight = 0, avlComparisons = 0, unbalancedComparisons = 0, timesDeeper = 0.0 };

            var readings = tree.InOrder().Take(Math.Clamp(sample, 10, 5000)).ToList();

            var plain = new UnbalancedBst<DateTime>();
            var balanced = new AvlTree<DateTime, HistoryPoint>();

            foreach (var point in readings)
            {
                plain.Insert(point.Timestamp);
                balanced.Insert(point.Timestamp, point);
            }

            // Keys that only increase land on the right every time, so the newest reading sits at
            // the very bottom of the unbalanced tree and is the honest worst case to measure.
            var newest = readings[readings.Count - 1].Timestamp;
            var plainHeight = plain.Height();
            var avlHeight = balanced.Height;

            return new
            {
                deviceId,
                sampled = readings.Count,
                avlHeight,
                unbalancedHeight = plainHeight,
                avlComparisons = balanced.ComparisonsToFind(newest),
                unbalancedComparisons = plain.ComparisonsToFind(newest),
                rotations = balanced.Rotations,
                timesDeeper = avlHeight == 0 ? 0 : Math.Round((double)plainHeight / avlHeight, 1)
            };
        }
    }
    //-----------//

    // How many devices and readings the archive holds in total.
    public (int Devices, int Readings) Totals()
    {
        lock (_lock)
        {
            return (_trees.Count, _trees.Values.Sum(t => t.Count));
        }
    }
    //-----------//
}
