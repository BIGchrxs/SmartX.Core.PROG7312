import { useEffect, useState } from "react";
import type { HistoryPoint } from "../types";
import { getHistory } from "../api";
import { formatClock } from "../status";

interface Props {
  deviceId: string | null;
  isBool: boolean;
  unit: string;
}

const WIDTH = 960;
const HEIGHT = 260;
const PAD = { left: 84, right: 16, top: 16, bottom: 30 };
const REFRESH_MS = 3000;

const DOT_COLOUR: Record<string, string> = {
  Warning: "var(--status-stale)",
  Critical: "var(--status-critical)",
};

// Turns the points into an SVG path. On/off devices use steps, so a switch looks like a switch.
function buildPath(coords: { x: number; y: number }[], step: boolean): string {
  return coords
    .map((c, i) => {
      if (i === 0) return `M${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
      return step ? `H${c.x.toFixed(1)} V${c.y.toFixed(1)}` : `L${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
    })
    .join(" ");
}
//-----------//

// One device's stored timeline, drawn from the API's sorted history. It refreshes every few seconds.
export default function TimelineChart({ deviceId, isBool, unit }: Props) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setPoints([]);
      return;
    }

    let cancelled = false;
    setPoints([]);

    // Loads the newest stored points for this device.
    async function load(id: string) {
      try {
        const result = await getHistory(id, 120);
        if (cancelled) return;
        setPoints(result.points);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load history.");
      }
    }
    //-----------//

    void load(deviceId);
    const timer = setInterval(() => void load(deviceId), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [deviceId]);

  if (!deviceId) {
    return <p className="empty-state">Pick a device to see its timeline.</p>;
  }
  if (error) {
    return <div className="banner banner--error">{error}</div>;
  }
  if (points.length < 2) {
    return <p className="empty-state">Not enough readings for {deviceId} yet. Run the simulator to build a timeline.</p>;
  }

  const times = points.map((p) => new Date(p.timestamp).getTime());
  const values = points.map((p) => p.value);
  const tMin = times[0];
  const tMax = times[times.length - 1];
  let vMin = isBool ? 0 : Math.min(...values);
  let vMax = isBool ? 1 : Math.max(...values);
  if (vMax === vMin) {
    vMin -= 1;
    vMax += 1;
  }

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const xFor = (t: number) => PAD.left + (tMax === tMin ? 0 : ((t - tMin) / (tMax - tMin)) * plotW);
  const yFor = (v: number) => PAD.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

  const coords = points.map((p, i) => ({ x: xFor(times[i]), y: yFor(p.value) }));
  const label = (v: number) =>
    isBool ? (v >= 1 ? "ON" : "OFF") : `${Math.round(v * 10) / 10}${unit ? ` ${unit}` : ""}`;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Timeline of ${deviceId}: ${points.length} readings from ${formatClock(points[0].timestamp)} to ${formatClock(points[points.length - 1].timestamp)}`}
      >
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top} y2={PAD.top} className="chart-grid" />
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="chart-grid" />

        <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" className="chart-label">
          {label(vMax)}
        </text>
        <text x={PAD.left - 8} y={PAD.top + plotH + 4} textAnchor="end" className="chart-label">
          {label(vMin)}
        </text>
        <text x={PAD.left} y={HEIGHT - 8} textAnchor="start" className="chart-label">
          {formatClock(points[0].timestamp)}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" className="chart-label">
          {formatClock(points[points.length - 1].timestamp)}
        </text>

        <path d={buildPath(coords, isBool)} className="chart-line" fill="none" />

        {points.map((p, i) =>
          p.severity === "Normal" ? null : (
            <circle key={p.timestamp} cx={coords[i].x} cy={coords[i].y} r={3.5} fill={DOT_COLOUR[p.severity]}>
              <title>{`${formatClock(p.timestamp)}: ${label(p.value)} (${p.severity})`}</title>
            </circle>
          )
        )}
      </svg>
      <figcaption className="chart-caption">
        {points.length} stored readings, oldest to newest. Amber and red dots mark warning and critical readings.
      </figcaption>
    </figure>
  );
}
//-----------//
