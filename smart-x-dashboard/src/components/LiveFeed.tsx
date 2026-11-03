import { useMemo } from "react";
import type { RecentReading, SensorRegistration } from "../types";
import { formatClock, formatValue, unitFor } from "../status";

interface Props {
  readings: RecentReading[];
  sensors: SensorRegistration[];
}

// The newest readings from every device, with the unit beside each value and warnings picked out.
export default function LiveFeed({ readings, sensors }: Props) {
  const byId = useMemo(() => new Map(sensors.map((s) => [s.deviceId, s])), [sensors]);

  return (
    <section className="panel">
      <h2>Live feed</h2>

      {readings.length === 0 ? (
        <p className="empty-state">No readings yet. Run the simulator to start the stream.</p>
      ) : (
        <ul className="feed-list">
          {readings.map((reading) => {
            const sensor = byId.get(reading.deviceId);
            const isBool = sensor?.valueType === "Bool";
            const unit = sensor ? unitFor(sensor.zone, sensor.category) : "";

            return (
              <li key={`${reading.deviceId}-${reading.timestamp}`} className={`feed-row feed-row--${reading.severity.toLowerCase()}`}>
                <span className="row-time">{formatClock(reading.timestamp)}</span>
                <strong>{reading.deviceId}</strong>
                <span className="feed-zone">{reading.zone}</span>
                <span className="feed-value">{formatValue(reading.value, isBool)}</span>
                <span className="feed-unit">{unit}</span>
                {reading.severity !== "Normal" && <span className="row-tag">{reading.severity}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
//-----------//
