using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// Remembers what the operator searches for and which commands they run, together with the
/// alerts that were active at the time. From that it learns habits, for example "when the
/// humidity alert is active, the operator switches the dehumidifier on". Counts are updated
/// as events arrive, so reading a habit never means rescanning the whole log.
/// </summary>
public class ActivityLog
{
    public const int MinSupport = 3;          // a habit needs at least this many incidents
    public const double MinConfidence = 0.6;  // and must happen in at least this share of them
    private const int MaxEvents = 500;

    private readonly object _lock = new();
    private readonly AlertTracker _alerts;
    private readonly List<UserEvent> _events = new();
    private readonly Dictionary<string, int> _frequency = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Dictionary<string, int>> _patterns = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _counted = new(StringComparer.OrdinalIgnoreCase);
    private bool _seeded;

    // Needs the alert tracker so it can see which conditions are active.
    public ActivityLog(AlertTracker alerts)
    {
        _alerts = alerts;
    }
    //-----------//

    // Builds the action key for a search, for example "search|crac".
    public static string SearchAction(string term) => $"search|{term}";
    //-----------//

    // Builds the action key for a command, for example "command|ITC-CRAC-01|ON".
    public static string CommandAction(string deviceId, bool on) => $"command|{deviceId}|{(on ? "ON" : "OFF")}";
    //-----------//

    // Lower-cases and trims a search term. The pipe is reserved as the key separator.
    public static string NormalizeTerm(string term) => term.Trim().ToLowerInvariant().Replace('|', ' ');
    //-----------//

    // Records a settled search. Terms shorter than two characters are ignored.
    public void RecordSearch(string term, string source = "user")
    {
        var normalized = NormalizeTerm(term ?? "");
        if (normalized.Length < 2)
            return;

        Record("search", normalized, null, SearchAction(normalized), source);
    }
    //-----------//

    // Records a command the operator ran.
    public void RecordCommand(string deviceId, bool on, string source = "user")
    {
        Record("command", deviceId, on ? "ON" : "OFF", CommandAction(deviceId, on), source);
    }
    //-----------//

    // Stores the event, bumps the frequency count, and updates the condition-to-action counts.
    private void Record(string kind, string subject, string? detail, string action, string source)
    {
        // Read the alert state first so this class never holds its lock while calling the tracker.
        var conditions = _alerts.ActiveKeys();
        var incidents = conditions.Select(c => (Condition: c, Incident: _alerts.IncidentCount(c))).ToList();

        lock (_lock)
        {
            _events.Add(new UserEvent(DateTime.UtcNow, kind, subject, detail, conditions, source));
            if (_events.Count > MaxEvents)
                _events.RemoveAt(0);

            _frequency[action] = (_frequency.TryGetValue(action, out var f) ? f : 0) + 1;

            foreach (var (condition, incident) in incidents)
            {
                // A set makes each action count once per incident, however often the button is pressed.
                if (!_counted.Add($"{condition}#{action}#{incident}"))
                    continue;

                AddPatternCount(condition, action, 1);
            }
        }
    }
    //-----------//

    // Adds to the count for one condition and action. Call only while holding the lock.
    private void AddPatternCount(string condition, string action, int amount)
    {
        if (!_patterns.TryGetValue(condition, out var actions))
        {
            actions = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            _patterns[condition] = actions;
        }

        actions[action] = (actions.TryGetValue(action, out var n) ? n : 0) + amount;
    }
    //-----------//

    // The habits that apply to the alerts active right now, strongest first.
    public IReadOnlyList<HabitPattern> Habits(IEnumerable<string> activeConditions)
    {
        var result = new List<HabitPattern>();

        foreach (var condition in activeConditions)
        {
            var incidents = _alerts.IncidentCount(condition);

            lock (_lock)
            {
                if (!_patterns.TryGetValue(condition, out var actions))
                    continue;

                foreach (var (action, count) in actions)
                {
                    var confidence = incidents == 0 ? 0 : Math.Min(1.0, (double)count / incidents);
                    if (count >= MinSupport && confidence >= MinConfidence)
                        result.Add(new HabitPattern(condition, action, count, incidents, Math.Round(confidence, 2)));
                }
            }
        }

        return result.OrderByDescending(h => h.Confidence).ThenByDescending(h => h.Count).ToList();
    }
    //-----------//

    // The most frequent searches that have reached the minimum count.
    public IReadOnlyList<(string Term, int Count)> TopSearches(int take)
    {
        lock (_lock)
        {
            return _frequency
                .Where(kv => kv.Key.StartsWith("search|", StringComparison.Ordinal) && kv.Value >= MinSupport)
                .OrderByDescending(kv => kv.Value)
                .Take(take)
                .Select(kv => (kv.Key.Substring("search|".Length), kv.Value))
                .ToList();
        }
    }
    //-----------//

    // The newest logged events, newest first.
    public IReadOnlyList<UserEvent> Events(int limit)
    {
        lock (_lock)
        {
            return _events.OrderByDescending(e => e.Timestamp).Take(limit).ToList();
        }
    }
    //-----------//

    // Adds a believable operator history so suggestions appear without hours of clicking.
    // Returns false if the demo history was already added.
    public bool SeedDemoHistory()
    {
        lock (_lock)
        {
            if (_seeded)
                return false;
            _seeded = true;
        }

        var seeds = new (string Condition, string Action, string Kind, string Subject, string? Detail, int Times)[]
        {
            ("MS-HUM-01:Critical", CommandAction("MS-DEHUM-01", true), "command", "MS-DEHUM-01", "ON", 4),
            ("ITC-TEMP-01:Critical", CommandAction("ITC-CRAC-01", true), "command", "ITC-CRAC-01", "ON", 3),
            ("ITC-TEMP-01:Critical", SearchAction("crac"), "search", "crac", null, 3)
        };

        // Each condition's incidents are added once, even if it has several habits.
        var seededConditions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var seed in seeds)
        {
            if (seededConditions.Add(seed.Condition))
                _alerts.SeedIncidents(seed.Condition, seed.Times);

            lock (_lock)
            {
                AddPatternCount(seed.Condition, seed.Action, seed.Times);
                _frequency[seed.Action] = (_frequency.TryGetValue(seed.Action, out var f) ? f : 0) + seed.Times;

                for (var i = 0; i < seed.Times; i++)
                {
                    var when = DateTime.UtcNow.AddHours(-3 * (i + 1));
                    _events.Add(new UserEvent(when, seed.Kind, seed.Subject, seed.Detail, new[] { seed.Condition }, "demo"));
                }
            }
        }

        return true;
    }
    //-----------//
}
