using SmartX.Api.Models;

namespace SmartX.Api.Services;

/// <summary>
/// A limit rule for one sensor category, optionally restricted to a single zone.
/// A reading at or above WarnAbove is out of range. At or above CriticalAbove it is critical.
/// </summary>
public sealed record ThresholdRule(
    string? Zone,
    SensorCategory Category,
    string Unit,
    string Label,
    double WarnAbove,
    double CriticalAbove);

/// <summary>The result of checking one reading against the rules.</summary>
public sealed record ThresholdResult(ReadingSeverity Severity, int Priority, string? Reason);

/// <summary>
/// Holds the Studio HQ limits and decides how serious a reading is. Zone-specific rules
/// are checked before general category rules. Sensors with no matching rule are always Normal.
/// </summary>
public class ThresholdPolicy
{
    private readonly List<ThresholdRule> _rules = new()
    {
        new("IT Closet", SensorCategory.Environmental, "°C", "Server rack temperature", 30, 35),
        new("Material Storage", SensorCategory.Environmental, "%", "Fabric cabinet humidity", 60, 70),
        new(null, SensorCategory.Power, "W", "Power draw", 2500, 3500)
    };

    public IReadOnlyList<ThresholdRule> Rules => _rules;

    // Finds the rule that applies to a zone and category, preferring a zone-specific rule.
    public ThresholdRule? FindRule(string zone, SensorCategory category)
    {
        var specific = _rules.FirstOrDefault(r =>
            r.Category == category && string.Equals(r.Zone, zone, StringComparison.OrdinalIgnoreCase));

        return specific ?? _rules.FirstOrDefault(r => r.Category == category && r.Zone is null);
    }
    //-----------//

    // Checks a reading against its rule. Priority grows with how far past the critical limit it is.
    public ThresholdResult Evaluate(string zone, SensorCategory category, double value)
    {
        var rule = FindRule(zone, category);
        if (rule is null)
            return new ThresholdResult(ReadingSeverity.Normal, 0, null);

        if (value >= rule.CriticalAbove)
        {
            var priority = (int)Math.Round(value / rule.CriticalAbove * 100);
            var reason = $"{rule.Label} is {value:0.#}{rule.Unit}, at or above the critical limit of {rule.CriticalAbove:0.#}{rule.Unit}";
            return new ThresholdResult(ReadingSeverity.Critical, priority, reason);
        }

        if (value >= rule.WarnAbove)
        {
            var reason = $"{rule.Label} is {value:0.#}{rule.Unit}, at or above the warning limit of {rule.WarnAbove:0.#}{rule.Unit}";
            return new ThresholdResult(ReadingSeverity.Warning, 0, reason);
        }

        return new ThresholdResult(ReadingSeverity.Normal, 0, null);
    }
    //-----------//
}
