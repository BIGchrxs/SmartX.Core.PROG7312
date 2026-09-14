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

// Mirrors the zones registered in the backend's DeviceNode tree
// (Studio HQ -> these four). Keep in sync with SensorRegistry.BuildZoneTree().
export const ZONES = ["Showroom Floor", "Material Storage", "Workshop", "IT Closet"] as const;
export const CATEGORIES: SensorCategory[] = ["Environmental", "Power", "Actuator"];
export const VALUE_TYPES: TelemetryValueType[] = ["Float", "Int", "Bool"];