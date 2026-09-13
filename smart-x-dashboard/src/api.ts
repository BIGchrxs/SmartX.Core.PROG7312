import type { RegisterSensorInput, SensorRegistration } from "./types";

const BASE = "/api";

async function unwrap(res: Response): Promise<void> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with status ${res.status}`);
  }
}

export async function listSensors(): Promise<SensorRegistration[]> {
  const res = await fetch(`${BASE}/sensors`);
  await unwrap(res);
  return res.json();
}

export async function registerSensor(input: RegisterSensorInput): Promise<SensorRegistration> {
  const res = await fetch(`${BASE}/sensors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await unwrap(res);
  return res.json();
}

export async function sendTelemetry(deviceId: string, value: number | boolean): Promise<void> {
  const res = await fetch(`${BASE}/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, value }),
  });
  await unwrap(res);
}

export async function uploadMedia(deviceId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/sensors/${encodeURIComponent(deviceId)}/media`, {
    method: "POST",
    body: form,
  });
  await unwrap(res);
}
