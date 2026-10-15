import type { ActiveAlert, AlertType } from "../types";
import { formatClock } from "../status";

interface Props {
  alerts: ActiveAlert[];
}

const TYPE_LABEL: Record<AlertType, string> = {
  Disconnected: "Not reporting",
  OutOfRange: "Out of range",
  Critical: "Critical",
};

// The alert set. A device appears once per problem, however many readings repeat it.
export default function AlertsList({ alerts }: Props) {
  return (
    <section className="panel">
      <h2>
        Active alerts <span className="count-pill">{alerts.length}</span>
      </h2>

      {alerts.length === 0 ? (
        <p className="empty-state">All clear. Nothing is out of range.</p>
      ) : (
        <ul className="row-list">
          {alerts.map((alert) => (
            <li key={alert.key} className={`row row--${alert.type === "Critical" ? "critical" : alert.type === "OutOfRange" ? "warning" : "stale"}`}>
              <div className="row-main">
                <strong>{alert.deviceId}</strong>
                <span className="row-tag">{TYPE_LABEL[alert.type]}</span>
              </div>
              <p className="row-text">{alert.message}</p>
              <span className="row-time">since {formatClock(alert.raisedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
//-----------//
