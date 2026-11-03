import type { AlertEvent } from "../types";
import { formatClock } from "../status";

interface Props {
  events: AlertEvent[];
  raisedTotal: number;
  duplicatesIgnored: number;
}

// The alert log. It shows each alert raised once and recovered once, and counts the repeats the set refused.
export default function AlertHistory({ events, raisedTotal, duplicatesIgnored }: Props) {
  return (
    <section className="panel">
      <h2>Alert history</h2>

      <dl className="stat-grid">
        <div>
          <dt>Alerts raised</dt>
          <dd>{raisedTotal}</dd>
        </div>
        <div>
          <dt>Repeats ignored by the set</dt>
          <dd>{duplicatesIgnored}</dd>
        </div>
      </dl>

      <p className="panel-note">
        An alert is raised once. While the problem is still active, repeat readings are refused by the set. It can raise
        again only after a Recovered entry.
      </p>

      {events.length === 0 ? (
        <p className="empty-state">No alerts yet. Try the power-spike scenario.</p>
      ) : (
        <ul className="history-list">
          {events.map((event, index) => (
            <li key={`${event.timestamp}-${event.key}-${event.kind}-${index}`} className="history-row">
              <span className="row-time">{formatClock(event.timestamp)}</span>
              <span className={`row-tag row-tag--${event.kind.toLowerCase()}`}>{event.kind}</span>
              <strong>{event.key}</strong>
              <span className="history-text">{event.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
//-----------//
