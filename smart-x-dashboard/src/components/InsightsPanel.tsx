import { useState } from "react";
import type { Insight, InsightType } from "../types";
import { seedHistory } from "../api";

interface Props {
  insights: Insight[];
  busy: boolean;
  onApplyCommand: (insight: Insight) => void;
  onUseSearch: (term: string) => void;
  onRefresh: () => Promise<void>;
}

const TYPE_LABEL: Record<InsightType, string> = {
  Alert: "Alert",
  Trend: "Prediction",
  Habit: "Learned habit",
  Frequent: "Frequent search",
};

// The automated insights feed: alerts, trend predictions and suggestions learned from the operator's habits.
export default function InsightsPanel({ insights, busy, onApplyCommand, onUseSearch, onRefresh }: Props) {
  const [seeding, setSeeding] = useState(false);

  // Adds the demo operator history, then reloads the feed.
  async function handleSeed() {
    setSeeding(true);
    try {
      await seedHistory();
      await onRefresh();
    } finally {
      setSeeding(false);
    }
  }
  //-----------//

  return (
    <section className="panel panel--wide">
      <div className="panel-head">
        <h2>
          Automated insights <span className="count-pill">{insights.length}</span>
        </h2>
        <button type="button" className="btn-ghost" onClick={handleSeed} disabled={seeding}>
          {seeding ? "Loading..." : "Load demo history"}
        </button>
      </div>

      {insights.length === 0 ? (
        <p className="empty-state">
          Nothing to suggest right now. Predictions appear when a reading trends toward a limit, and learned
          suggestions appear when an alert matches something you have fixed before.
        </p>
      ) : (
        <ul className="insight-list">
          {insights.map((insight) => (
            <li key={insight.id} className={`insight insight--${insight.type.toLowerCase()}`}>
              <div className="insight-top">
                <span className="row-tag">{TYPE_LABEL[insight.type]}</span>
                <strong>{insight.title}</strong>
                {insight.type === "Habit" && (
                  <span className="insight-confidence" title="How often this fix worked in similar past situations">
                    {Math.round(insight.confidence * 100)}% sure
                  </span>
                )}
              </div>

              <p className="row-text">{insight.message}</p>
              <p className="insight-reason">{insight.reason}</p>

              {insight.command && (
                <button type="button" className="btn-primary" disabled={busy} onClick={() => onApplyCommand(insight)}>
                  Apply: turn {insight.command.deviceId} {insight.command.on ? "on" : "off"}
                </button>
              )}
              {insight.search && (
                <button type="button" className="btn-ghost" onClick={() => onUseSearch(insight.search!)}>
                  Search for &quot;{insight.search}&quot;
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
//-----------//
