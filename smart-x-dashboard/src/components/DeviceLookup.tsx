import { useCallback, useEffect, useRef, useState } from "react";
import type { SensorRegistration } from "../types";
import { getHistory, getSensor } from "../api";
import { useSessionState } from "../hooks/useSessionState";
import { usePolling } from "../hooks/usePolling";
import { formatClock, formatValue, unitFor } from "../status";

// Matches SmartXConstants.HistoryCapPerDevice in the API.
const HISTORY_CAP = 500;
const LOOKUP_REFRESH_MS = 3000;
const TYPING_SETTLE_MS = 300;

interface Found {
  sensor: SensorRegistration;
  stored: number;
  first: string | null;
  last: string | null;
}

// Look a device up by ID. The registry is a case-insensitive dictionary and the history is a sorted dictionary.
export default function DeviceLookup() {
  const [term, setTerm] = useSessionState("smartx.lookup", "");
  const [found, setFound] = useState<Found | null>(null);
  const [missing, setMissing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const latestRequest = useRef(0);

  // Asks the API for the device and its stored history. A newer request makes older answers get dropped.
  const lookup = useCallback(async (text: string) => {
    const id = text.trim();
    const request = ++latestRequest.current;

    if (!id) {
      setFound(null);
      setMissing(false);
      setProblem(null);
      return;
    }

    try {
      const sensor = await getSensor(id);
      if (request !== latestRequest.current) return;

      if (!sensor) {
        setFound(null);
        setMissing(true);
        setProblem(null);
        return;
      }

      const history = await getHistory(sensor.deviceId, HISTORY_CAP);
      if (request !== latestRequest.current) return;

      const points = history.points;
      setFound({
        sensor,
        stored: history.count,
        first: points.length > 0 ? points[0].timestamp : null,
        last: points.length > 0 ? points[points.length - 1].timestamp : null,
      });
      setMissing(false);
      setProblem(null);
    } catch (err) {
      if (request !== latestRequest.current) return;
      setProblem(err instanceof Error ? err.message : "The lookup failed.");
    }
  }, []);
  //-----------//

  // Looks up as soon as the typing settles.
  useEffect(() => {
    const timer = setTimeout(() => void lookup(term), TYPING_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [term, lookup]);

  // Keeps the stored count and times fresh while the page is open.
  usePolling(() => lookup(term), LOOKUP_REFRESH_MS);

  const sensor = found?.sensor;
  const unit = sensor ? unitFor(sensor.zone, sensor.category) : "";

  return (
    <section className="panel">
      <h2>Device lookup</h2>

      <label className="field">
        Device ID
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Try: ms-hum-01 (any letter case)"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <p className="panel-note">
        Devices are stored in a dictionary that ignores letter case. Each device's history is a sorted dictionary, so
        readings are always in time order.
      </p>

      {problem && <p className="sensor-problem">{problem}</p>}

      {missing && <p className="empty-state">No device is registered with the ID "{term.trim()}".</p>}

      {!found && !missing && !problem && <p className="empty-state">Type a device ID to look it up.</p>}

      {found && sensor && (
        <dl className="lookup-grid">
          <div>
            <dt>You typed</dt>
            <dd>{term.trim()}</dd>
          </div>
          <div>
            <dt>Registry found</dt>
            <dd>{sensor.deviceId}</dd>
          </div>
          <div className="lookup-wide">
            <dt>Zone and category</dt>
            <dd>
              {sensor.zone}, {sensor.category}
            </dd>
          </div>
          <div>
            <dt>Latest value</dt>
            <dd>
              {formatValue(sensor.lastValue, sensor.valueType === "Bool")}
              {unit && <span className="reading-unit">{unit}</span>}
            </dd>
          </div>
          <div>
            <dt>Stored readings</dt>
            <dd>
              {found.stored}
              <span className="stat-sub"> of {HISTORY_CAP} kept</span>
            </dd>
          </div>
          <div className="lookup-wide">
            <dt>Oldest and newest</dt>
            <dd>{found.first && found.last ? `${formatClock(found.first)} to ${formatClock(found.last)}` : "No readings yet"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
//-----------//
