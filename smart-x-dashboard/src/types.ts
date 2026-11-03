export type SensorCategory = "Environmental" | "Power" | "Actuator";
export type TelemetryValueType = "Float" | "Int" | "Bool";

export interface SensorRegistration {
  deviceId: string;
  macAddress: string;
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
  macAddress?: string;
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
export type Route = "home" | "ingestion" | "command" | "topology";

// Part 3: the mesh network, its traversals and spanning trees, and the AVL archive.

export type MeshNodeKind = "Gateway" | "Repeater" | "Sensor";

export interface MeshNode {
  id: string;
  mac: string;
  zone: string;
  kind: MeshNodeKind;
  x: number;
  y: number;
  online: boolean;
}

export interface MeshLink {
  from: string;
  to: string;
  cost: number;
}

export interface MeshPath {
  fromId: string;
  toId: string;
  reachable: boolean;
  hops: string[];
  legs: MeshLink[];
  totalCost: number;
  method: string;
}

export interface MstResult {
  algorithm: string;
  edges: MeshLink[];
  totalCost: number;
  nodesSpanned: number;
  spansWholeNetwork: boolean;
  elapsedTicks: number;
  queueOperations: number;
}

export interface MeshSnapshot {
  gatewayId: string;
  nodes: MeshNode[];
  links: MeshLink[];
  prim: MstResult;
  kruskal: MstResult;
  algorithmsAgree: boolean;
}

export interface TraversalResult {
  algorithm: string;
  startId: string;
  order: string[];
  reachable: string[];
  unreachable: string[];
  offline: string[];
  edgesExamined: number;
}

export interface RouteReport {
  node: MeshNode;
  spanning: MeshPath;
  cheapest: MeshPath;
  spanningCostsMore: boolean;
}

export interface ArchiveStats {
  deviceId: string;
  archived: number;
  height: number;
  idealHeight: number;
  rotations: number;
  balanced: boolean;
  oldest: string | null;
  newest: string | null;
}

export interface RangeQueryReport {
  deviceId: string;
  from: string;
  to: string;
  matches: number;
  archivedReadings: number;
  treeHeight: number;
  idealHeight: number;
  rotations: number;
  treeNodesVisited: number;
  listItemsScanned: number;
  treeTicks: number;
  listTicks: number;
  answersMatch: boolean;
}

export interface RangeQueryResponse {
  report: RangeQueryReport;
  count: number;
  points: HistoryPoint[];
}

export interface BalanceProof {
  deviceId: string;
  sampled: number;
  avlHeight: number;
  unbalancedHeight: number;
  avlComparisons: number;
  unbalancedComparisons: number;
  rotations: number;
  timesDeeper: number;
}

export interface ArchiveResponse {
  deviceId: string;
  count: number;
  stats: ArchiveStats;
  points: HistoryPoint[];
}

// Mirrors the zones registered in the backend's DeviceNode tree
// (Studio HQ -> these four). Keep in sync with SensorRegistry.BuildZoneTree().
export const ZONES = ["Showroom Floor", "Material Storage", "Workshop", "IT Closet"] as const;
export const CATEGORIES: SensorCategory[] = ["Environmental", "Power", "Actuator"];
export const VALUE_TYPES: TelemetryValueType[] = ["Float", "Int", "Bool"];
