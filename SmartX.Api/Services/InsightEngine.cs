using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// Builds the Automated Insights feed. It combines three things: alerts that are active now,
/// trends that are heading for a limit, and habits learned from what the operator did the
/// last time the same alert was active. A PriorityQueue orders the result so the most urgent
/// insight is always first.
/// </summary>
public class InsightEngine
{
    private const int TrendWindow = 8;              // readings used for the trend line
    private const int MinTrendPoints = 5;           // fewer readings than this is not a trend
    private const double MinTrendSpanSeconds = 4;   // readings bunched into a burst are ignored
    private const double TrendHorizonMinutes = 15;  // only warn about limits this close
    private const double MinTrendFit = 0.7;         // R squared needed to call it a real trend
    private const double MaxTrendAgeSeconds = 60;   // a silent device's old trend is not trusted

    private readonly AlertTracker _alerts;
    private readonly ActivityLog _activity;
    private readonly TelemetryHistory _history;
    private readonly SensorRegistry _registry;
    private readonly ThresholdPolicy _thresholds;

    // Receives every service it reads from.
    public InsightEngine(
        AlertTracker alerts,
        ActivityLog activity,
        TelemetryHistory history,
        SensorRegistry registry,
        ThresholdPolicy thresholds)
    {
        _alerts = alerts;
        _activity = activity;
        _history = history;
        _registry = registry;
        _thresholds = thresholds;
    }
    //-----------//

    // Collects every insight and returns them most urgent first.
    public IReadOnlyList<Insight> Build()
    {
        var queue = new PriorityQueue<Insight, (int NegativeRank, double NegativeConfidence)>();
        var activeAlerts = _alerts.Active();

        foreach (var alert in activeAlerts)
            Add(queue, FromAlert(alert));

        foreach (var habit in _activity.Habits(activeAlerts.Select(a => a.Key)))
        {
            var insight = FromHabit(habit);
            if (insight is not null)
                Add(queue, insight);
        }

        foreach (var sensor in _registry.All)
        {
            var insight = TryTrend(sensor, activeAlerts);
            if (insight is not null)
                Add(queue, insight);
        }

        foreach (var (term, count) in _activity.TopSearches(2))
            Add(queue, FromFrequent(term, count));

        var ordered = new List<Insight>(queue.Count);
        while (queue.TryDequeue(out var next, out _))
            ordered.Add(next);

        return ordered;
    }
    //-----------//

    // Puts an insight in the queue. A bigger rank, then a bigger confidence, comes out first.
    private static void Add(PriorityQueue<Insight, (int, double)> queue, Insight insight)
    {
        queue.Enqueue(insight, (-insight.Rank, -insight.Confidence));
    }
    //-----------//

    // Turns an active alert into an insight.
    private static Insight FromAlert(ActiveAlert alert)
    {
        var (title, rank) = alert.Type switch
        {
            AlertType.Critical => ("Critical reading", 100),
            AlertType.Disconnected => ("Not reporting", 70),
            _ => ("Out of range", 60)
        };

        return new Insight(
            $"alert:{alert.Key}",
            "Alert",
            title,
            alert.Message,
            $"Active since {alert.RaisedAt:HH:mm:ss} UTC",
            1.0,
            alert.DeviceId,
            null,
            null,
            rank);
    }
    //-----------//

    // Turns a learned habit into a one-click suggestion. Returns null if it no longer applies.
    private Insight? FromHabit(HabitPattern habit)
    {
        var parts = habit.Action.Split('|');
        var conditionDevice = habit.Condition[..habit.Condition.LastIndexOf(':')];
        var reason = $"When {habit.Condition} was active, you did this in {habit.Count} of {habit.Incidents} incidents.";

        if (parts.Length == 3 && parts[0] == "command")
        {
            var deviceId = parts[1];
            var on = parts[2] == "ON";

            // Do not suggest something that is already done.
            if (_registry.TryGet(deviceId, out var sensor) && sensor is not null && sensor.LastValue is bool state && state == on)
                return null;

            return new Insight(
                $"habit:{habit.Condition}>{habit.Action}",
                "Habit",
                "Suggested action",
                $"Turn {deviceId} {(on ? "on" : "off")}",
                reason,
                habit.Confidence,
                conditionDevice,
                new SuggestedCommand(deviceId, on),
                null,
                50);
        }

        if (parts.Length == 2 && parts[0] == "search")
        {
            return new Insight(
                $"habit:{habit.Condition}>{habit.Action}",
                "Habit",
                "Suggested search",
                $"Search for \"{parts[1]}\"",
                reason,
                habit.Confidence,
                conditionDevice,
                null,
                parts[1],
                45);
        }

        return null;
    }
    //-----------//

    // Turns a frequently repeated search into a quick shortcut.
    private static Insight FromFrequent(string term, int count)
    {
        return new Insight(
            $"frequent:{term}",
            "Frequent",
            "Quick search",
            $"You often search for \"{term}\"",
            $"Searched {count} times.",
            Math.Min(1.0, count / 10.0),
            null,
            null,
            term,
            20);
    }
    //-----------//

    // Looks for a reading that is climbing toward its critical limit and estimates when it gets there.
    private Insight? TryTrend(SensorRegistration sensor, IReadOnlyList<ActiveAlert> activeAlerts)
    {
        var rule = _thresholds.FindRule(sensor.Zone, sensor.Category);
        if (rule is null)
            return null;

        // Alerts already cover devices that are critical or silent.
        if (activeAlerts.Any(a => string.Equals(a.DeviceId, sensor.DeviceId, StringComparison.OrdinalIgnoreCase)
                                  && a.Type is AlertType.Critical or AlertType.Disconnected))
            return null;

        var window = _history.Window(sensor.DeviceId, TrendWindow);
        if (window.Count < MinTrendPoints)
            return null;

        var latest = window[^1];
        var span = (latest.Timestamp - window[0].Timestamp).TotalSeconds;
        var age = (DateTime.UtcNow - latest.Timestamp).TotalSeconds;

        if (latest.Value >= rule.CriticalAbove || span < MinTrendSpanSeconds || age > MaxTrendAgeSeconds)
            return null;

        var (slope, fit) = Fit(window);
        if (slope <= 0 || fit < MinTrendFit)
            return null;

        var minutesLeft = (rule.CriticalAbove - latest.Value) / slope;
        if (minutesLeft > TrendHorizonMinutes)
            return null;

        return new Insight(
            $"trend:{sensor.DeviceId}",
            "Trend",
            "Heading for its limit",
            $"{sensor.DeviceId} is rising by {slope:0.0}{rule.Unit} a minute and may reach {rule.CriticalAbove:0.#}{rule.Unit} in about {FormatEta(minutesLeft)}.",
            $"Based on the last {window.Count} readings, trend fit {fit:0.00}.",
            Math.Round(fit, 2),
            sensor.DeviceId,
            null,
            null,
            80);
    }
    //-----------//

    // Least squares line through the readings. Returns the slope per minute and R squared.
    private static (double Slope, double Fit) Fit(IReadOnlyList<HistoryPoint> points)
    {
        var start = points[0].Timestamp;
        var xs = points.Select(p => (p.Timestamp - start).TotalMinutes).ToArray();
        var ys = points.Select(p => p.Value).ToArray();

        var meanX = xs.Average();
        var meanY = ys.Average();

        var sxx = xs.Sum(x => (x - meanX) * (x - meanX));
        var syy = ys.Sum(y => (y - meanY) * (y - meanY));
        var sxy = xs.Zip(ys, (x, y) => (x - meanX) * (y - meanY)).Sum();

        if (sxx < 1e-9)
            return (0, 0);

        var slope = sxy / sxx;
        var fit = syy < 1e-9 ? 0 : sxy * sxy / (sxx * syy);
        return (slope, fit);
    }
    //-----------//

    // Writes a time estimate in seconds or minutes.
    private static string FormatEta(double minutes) =>
        minutes < 1 ? $"{Math.Max(1, Math.Round(minutes * 60))} seconds" : $"{minutes:0.#} minutes";
    //-----------//
}
