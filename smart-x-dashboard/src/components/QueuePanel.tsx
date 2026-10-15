import type { QueueStatus } from "../types";
import { formatClock } from "../status";

interface Props {
  status: QueueStatus | null;
}

// Shows what is waiting in the two ingestion queues and how the last critical reading jumped the line.
export default function QueuePanel({ status }: Props) {
  if (!status) {
    return (
      <section className="panel">
        <h2>Ingestion queues</h2>
        <p className="empty-state">Waiting for the API.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Ingestion queues</h2>
      <dl className="stat-grid">
        <div>
          <dt>Normal (FIFO)</dt>
          <dd>{status.fifoDepth}</dd>
        </div>
        <div>
          <dt>Critical (priority)</dt>
          <dd className={status.priorityDepth > 0 ? "summary-hot" : ""}>{status.priorityDepth}</dd>
        </div>
        <div>
          <dt>Processed</dt>
          <dd>
            {status.totalProcessed}
            <span className="stat-sub"> of {status.totalEnqueued}</span>
          </dd>
        </div>
        <div>
          <dt>Critical handled</dt>
          <dd>{status.criticalProcessed}</dd>
        </div>
      </dl>

      <p className="panel-note">
        {status.lastCriticalAt
          ? `Last critical reading at ${formatClock(status.lastCriticalAt)} was served ahead of ${status.lastCriticalBypassedBacklog} waiting reading(s).`
          : "No critical reading has been processed yet."}
      </p>
    </section>
  );
}
//-----------//
