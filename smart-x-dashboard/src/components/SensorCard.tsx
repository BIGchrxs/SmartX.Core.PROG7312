import { useEffect, useState, type ChangeEvent } from "react";
import type { SensorRegistration } from "../types";
import { formatAge, formatValue, getStatus, STATUS_LABEL } from "../status";

interface Props {
  sensor: SensorRegistration;
  onSendTelemetry: (value: number | boolean) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}

// One live card: the latest value, how fresh it is, a manual send box and a file attach control.
export default function SensorCard({ sensor, onSendTelemetry, onUpload }: Props) {
  const [, forceTick] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Re-render once a second so the age label and status colour visibly age
  // between polls, without needing a network call every second.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const status = getStatus(sensor.lastSeenAt);

  // Turns the typed text into the right type and sends it. The API's complaint, if any, is shown on the card.
  async function handleSend() {
    if (!inputValue.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const value =
        sensor.valueType === "Bool"
          ? inputValue.trim().toLowerCase() === "true"
          : sensor.valueType === "Int"
          ? Math.trunc(Number(inputValue))
          : Number(inputValue);
      await onSendTelemetry(value);
      setInputValue("");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not send that reading.");
    } finally {
      setBusy(false);
    }
  }
  //-----------//

  // Uploads the chosen file to this sensor's profile.
  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      await onUpload(file);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not upload that file.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  //-----------//

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
        <span className="sensor-reading-value">{formatValue(sensor.lastValue, sensor.valueType === "Bool")}</span>
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

      {problem && <p className="sensor-problem">{problem}</p>}

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
//-----------//
