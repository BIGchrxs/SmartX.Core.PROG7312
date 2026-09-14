import { useEffect, useState, type ChangeEvent } from "react";
import type { SensorRegistration } from "../types";

interface Props {
  sensor: SensorRegistration;
  onSendTelemetry: (value: number | boolean) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}

type Status = "fresh" | "stale" | "critical" | "never";

const STALE_AFTER_SECONDS = 15;
const CRITICAL_AFTER_SECONDS = 45;

function getStatus(lastSeenAt: string | null | undefined): Status {
  if (!lastSeenAt) return "never";
  const seconds = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  if (seconds < STALE_AFTER_SECONDS) return "fresh";
  if (seconds < CRITICAL_AFTER_SECONDS) return "stale";
  return "critical";
}

function formatAge(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "No readings yet";
  const seconds = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 1000);
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

const STATUS_LABEL: Record<Status, string> = {
  fresh: "Live",
  stale: "Slow to report",
  critical: "Not reporting",
  never: "Awaiting first reading",
};

export default function SensorCard({ sensor, onSendTelemetry, onUpload }: Props) {
  const [, forceTick] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);

  // Re-render once a second so the age label and status colour visibly age
  // between polls, without needing a network call every second.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const status = getStatus(sensor.lastSeenAt);

  async function handleSend() {
    if (!inputValue.trim()) return;
    setBusy(true);
    try {
      const value =
        sensor.valueType === "Bool"
          ? inputValue.trim().toLowerCase() === "true"
          : sensor.valueType === "Int"
          ? Math.trunc(Number(inputValue))
          : Number(inputValue);
      await onSendTelemetry(value);
      setInputValue("");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <article className={`sensor-card sensor-card--${status}`}>
      <div className="sensor-card-top">
        <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
        <div className="sensor-identity">
          <h3>{sensor.deviceId}</h3>
          <p className="sensor-zone">{sensor.zone}</p>
        </div>
        <span className="category-tag">{sensor.category}</span>
      </div>

      <div className="sensor-reading">
        <span className="sensor-reading-value">
          {sensor.lastValue === null || sensor.lastValue === undefined ? "—" : String(sensor.lastValue)}
        </span>
        <div className="sensor-reading-meta">
          <span className={`status-label status-label--${status}`}>{STATUS_LABEL[status]}</span>
          <span className="sensor-reading-age">{formatAge(sensor.lastSeenAt)}</span>
        </div>
      </div>

      <div className="sensor-actions">
        <input
          className="sensor-input"
          placeholder={sensor.valueType === "Bool" ? "true / false" : "Value"}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={busy}
        />
        <button type="button" onClick={handleSend} disabled={busy || !inputValue.trim()}>
          Send reading
        </button>
      </div>

      <label className="upload-control">
        <span>Attach a file</span>
        <input type="file" onChange={handleFile} disabled={busy} />
      </label>

      {sensor.mediaFiles.length > 0 && (
        <p className="media-list">
          {sensor.mediaFiles.length} file{sensor.mediaFiles.length === 1 ? "" : "s"} attached: {sensor.mediaFiles.join(", ")}
        </p>
      )}
    </article>
  );
}