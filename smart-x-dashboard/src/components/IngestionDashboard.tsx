import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SensorCategory, SensorRegistration, TelemetryValueType } from "../types";
import { ZONES, CATEGORIES, VALUE_TYPES } from "../types";
import { listSensors, registerSensor, sendTelemetry, uploadMedia } from "../api";
import SensorCard from "./SensorCard";

interface Props {
  onBack: () => void;
}

const POLL_INTERVAL_MS = 4000;

export default function IngestionDashboard({ onBack }: Props) {
  const [sensors, setSensors] = useState<SensorRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deviceId, setDeviceId] = useState("");
  const [zone, setZone] = useState<string>(ZONES[0]);
  const [category, setCategory] = useState<SensorCategory>("Environmental");
  const [valueType, setValueType] = useState<TelemetryValueType>("Float");
  const [registering, setRegistering] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await listSensors();
      setSensors(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    const trimmed = deviceId.trim();
    if (!trimmed) return;

    setRegistering(true);
    setError(null);
    try {
      await registerSensor({ deviceId: trimmed, zone, category, valueType });
      setDeviceId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register sensor.");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <button type="button" className="back-link" onClick={onBack}>
          &larr; Back to gateway
        </button>
        <h1>Sensor Data Ingestion &amp; Telemetry</h1>
        <p>
          {sensors.length} sensor{sensors.length === 1 ? "" : "s"} registered across Studio HQ
        </p>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      <section className="register-panel">
        <h2>Register a sensor</h2>
        <form onSubmit={handleRegister} className="register-form">
          <label>
            Device ID
            <input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. ITC-TEMP-02"
              required
            />
          </label>
          <label>
            Zone
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as SensorCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Value type
            <select value={valueType} onChange={(e) => setValueType(e.target.value as TelemetryValueType)}>
              {VALUE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={registering}>
            {registering ? "Registering…" : "Register sensor"}
          </button>
        </form>
      </section>

      <section className="sensor-grid-section">
        <h2>Live sensors</h2>
        {loading ? (
          <p className="empty-state">Loading sensors…</p>
        ) : sensors.length === 0 ? (
          <p className="empty-state">No sensors registered yet. Add one above to start streaming telemetry.</p>
        ) : (
          <div className="sensor-grid">
            {sensors.map((sensor) => (
              <SensorCard
                key={sensor.deviceId}
                sensor={sensor}
                onSendTelemetry={async (value) => {
                  await sendTelemetry(sensor.deviceId, value);
                  await refresh();
                }}
                onUpload={async (file) => {
                  await uploadMedia(sensor.deviceId, file);
                  await refresh();
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}