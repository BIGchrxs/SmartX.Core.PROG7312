export type SensorCategory = "Environmental" | "Power" | "Actuator";
export type TelemetryValueType = "Float" | "Int" | "Bool";

export interface SensorRegistration {
  deviceId: string;
  zone: string;
  category: SensorCategory;
  valueType: TelemetryValueType;
  registeredAt: string;
  mediaFiles: string[];
  lastValue?: number | boolean | null;
  lastSeenAt?: string | null;
}

export interface RegisterSensorInput {
  deviceId: string;
  zone: string;
  category: SensorCategory;
  valueType: TelemetryValueType;
}

// Part 2: the real-time command stream and history types. They mirror the API's JSON (camelCase).

export type Severity = "Normal" | "Warning" | "Critical";
export type AlertType = "Disconnected" | "OutOfRange" | "Critical";
export type InsightType = "Alert" | "Trend" | "Habit" | "Frequent";

export interface ActiveAlert {
  key: string;
  deviceId: string;
  type: AlertType;
  message: string;
  raisedAt: string;
}

export interface AlertsResponse {
  count: number;
  alerts: ActiveAlert[];
}

export interface AlertEvent {
  timestamp: string;
  key: string;
  kind: "Raised" | "Recovered";
  message: string;
}

export interface AlertEventsResponse {
  raisedTotal: number;
  duplicatesIgnored: number;
  events: AlertEvent[];
}

export interface CommandEntry {
  id: number;
  deviceId: string;
  newState: boolean;
  previousState: boolean;
  timestamp: string;
  source: string;
}

export interface CommandHistoryResponse {
  count: number;
  canUndo: boolean;
  commands: CommandEntry[];
}

export interface HistoryPoint {
  timestamp: string;
  value: number;
  severity: Severity;
}

export interface HistoryResponse {
  deviceId: string;
  count: number;
  points: HistoryPoint[];
}

export interface RecentReading {
  deviceId: string;
  zone: string;
  timestamp: string;
  value: number;
  severity: Severity;
}

export interface QueueStatus {
  fifoDepth: number;
  priorityDepth: number;
  totalEnqueued: number;
  totalProcessed: number;
  criticalProcessed: number;
  lastCriticalAt: string | null;
  lastCriticalBypassedBacklog: number;
  processingDelayMs: number;
}

export interface SuggestedCommand {
  deviceId: string;
  on: boolean;
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  message: string;
  reason: string;
  confidence: number;
  deviceId: string | null;
  command: SuggestedCommand | null;
  search: string | null;
  rank: number;
}

export interface InsightsResponse {
  generatedAt: string;
  count: number;
  insights: Insight[];
}

// The pages the main menu can open.
export type Route = "home" | "ingestion" | "command";

// Mirrors the zones registered in the backend's DeviceNode tree
// (Studio HQ -> these four). Keep in sync with SensorRegistry.BuildZoneTree().
export const ZONES = ["Showroom Floor", "Material Storage", "Workshop", "IT Closet"] as const;
export const CATEGORIES: SensorCategory[] = ["Environmental", "Power", "Actuator"];
export const VALUE_TYPES: TelemetryValueType[] = ["Float", "Int", "Bool"];
