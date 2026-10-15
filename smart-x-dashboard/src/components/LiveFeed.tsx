import type { RecentReading } from "../types";
import { formatClock, formatValue } from "../status";

interface Props {
  readings: RecentReading[];
  boolDevices: Set<string>;
}

// The newest readings from every device, with warnings and criticals picked out.
export default function LiveFeed({ readings, boolDevices }: Props) {
  return (
    <section className="panel">
      <h2>Live feed</h2>

      {readings.length === 0 ? (
        <p className="empty-state">No readings yet. Run the simulator to start the stream.</p>
      ) : (
        <ul className="feed-list">
          {readings.map((reading) => (
            <li key={`${reading.deviceId}-${reading.timestamp}`} className={`feed-row feed-row--${reading.severity.toLowerCase()}`}>
              <span className="row-time">{formatClock(reading.timestamp)}</span>
              <strong>{reading.deviceId}</strong>
              <span className="feed-zone">{reading.zone}</span>
              <span className="feed-value">{formatValue(reading.value, boolDevices.has(reading.deviceId))}</span>
              {reading.severity !== "Normal" && <span className="row-tag">{reading.severity}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
//-----------//
