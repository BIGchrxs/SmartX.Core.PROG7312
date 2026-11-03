import type {
  AlertEventsResponse,
  AlertsResponse,
  CommandEntry,
  CommandHistoryResponse,
  HistoryResponse,
  InsightsResponse,
  QueueStatus,
  RecentReading,
  RegisterSensorInput,
  SensorRegistration,
} from "./types";

const BASE = "/api";

// Throws an Error carrying the API's message when a request fails.
// Some errors arrive as a JSON string ("like this"), so the quotes are removed.
async function unwrap(res: Response): Promise<void> {
  if (!res.ok) {
    let message = await res.text().catch(() => "");
    try {
      const parsed: unknown = JSON.parse(message);
      if (typeof parsed === "string") message = parsed;
    } catch {
      // Plain text stays as it is.
    }
    throw new Error(message || `Request failed with status ${res.status}`);
  }
}
//-----------//

// Sends a JSON body with the given method and checks the response.
async function sendJson(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await unwrap(res);
  return res;
}
//-----------//

// ---------- Part 1 ----------

// Every registered sensor with its latest value.
export async function listSensors(): Promise<SensorRegistration[]> {
  const res = await fetch(`${BASE}/sensors`);
  await unwrap(res);
  return res.json();
}
//-----------//

// Registers a new sensor.
export async function registerSensor(input: RegisterSensorInput): Promise<SensorRegistration> {
  const res = await sendJson("POST", "/sensors", input);
  return res.json();
}
//-----------//

// Sends one reading. The API queues it and answers 202.
export async function sendTelemetry(deviceId: string, value: number | boolean): Promise<void> {
  await sendJson("POST", "/telemetry", { deviceId, value });
}
//-----------//

// Attaches a file to a sensor profile.
export async function uploadMedia(deviceId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/sensors/${encodeURIComponent(deviceId)}/media`, {
    method: "POST",
    body: form,
  });
  await unwrap(res);
}
//-----------//

// ---------- Part 2 ----------

// The active alert set.
export async function getActiveAlerts(): Promise<AlertsResponse> {
  const res = await fetch(`${BASE}/alerts/active`);
  await unwrap(res);
  return res.json();
}
//-----------//

// The alert log (raised and recovered) with the count of repeats the set ignored.
export async function getAlertEvents(limit = 20): Promise<AlertEventsResponse> {
  const res = await fetch(`${BASE}/alerts/events?limit=${limit}`);
  await unwrap(res);
  return res.json();
}
//-----------//

// One device by ID. The API finds it whatever the letter case. Returns null when it is not registered.
export async function getSensor(deviceId: string): Promise<SensorRegistration | null> {
  const res = await fetch(`${BASE}/sensors/${encodeURIComponent(deviceId)}`);
  if (res.status === 404) return null;
  await unwrap(res);
  return res.json();
}
//-----------//

// The undo stack, newest command first.
export async function getCommandHistory(): Promise<CommandHistoryResponse> {
  const res = await fetch(`${BASE}/commands/history`);
  await unwrap(res);
  return res.json();
}
//-----------//

// Switches an actuator on or off. The source says who asked (operator or suggestion).
export async function sendCommand(deviceId: string, on: boolean, source = "operator"): Promise<CommandEntry> {
  const res = await sendJson("POST", "/commands", { deviceId, on, source });
  return res.json();
}
//-----------//

// Undoes the most recent command.
export async function undoCommand(): Promise<CommandEntry> {
  const res = await sendJson("POST", "/commands/undo");
  return res.json();
}
//-----------//

// One device's timeline, oldest first.
export async function getHistory(deviceId: string, limit = 120): Promise<HistoryResponse> {
  const res = await fetch(`${BASE}/telemetry/history/${encodeURIComponent(deviceId)}?limit=${limit}`);
  await unwrap(res);
  return res.json();
}
//-----------//

// The newest readings from every device, newest first.
export async function getRecent(limit = 25): Promise<RecentReading[]> {
  const res = await fetch(`${BASE}/telemetry/recent?limit=${limit}`);
  await unwrap(res);
  return res.json();
}
//-----------//

// Queue depths and counters.
export async function getQueueStatus(): Promise<QueueStatus> {
  const res = await fetch(`${BASE}/queues/status`);
  await unwrap(res);
  return res.json();
}
//-----------//

// The ranked list of alerts, predictions and learned suggestions.
export async function getInsights(): Promise<InsightsResponse> {
  const res = await fetch(`${BASE}/insights`);
  await unwrap(res);
  return res.json();
}
//-----------//

// Logs a settled search term so the engine can learn from it.
export async function logSearch(term: string): Promise<void> {
  await sendJson("POST", "/activity/search", { term });
}
//-----------//

// Adds demo operator history so suggestions show straight away.
export async function seedHistory(): Promise<void> {
  const res = await fetch(`${BASE}/demo/seed-history`, { method: "POST" });
  if (res.status === 409) return; // already seeded, which is fine
  await unwrap(res);
}
//-----------//
