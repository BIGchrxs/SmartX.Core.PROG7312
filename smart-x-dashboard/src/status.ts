// Shared freshness helpers, used by the sensor cards and the Command Stream page.
// The limits match SmartXConstants in the API.

import type { SensorCategory } from "./types";

export type Status = "fresh" | "stale" | "critical" | "never";

export const STALE_AFTER_SECONDS = 15;
export const CRITICAL_AFTER_SECONDS = 45;

export const STATUS_LABEL: Record<Status, string> = {
  fresh: "Live",
  stale: "Slow to report",
  critical: "Not reporting",
  never: "Awaiting first reading",
};

// How fresh a device is, based on when it last reported.
export function getStatus(lastSeenAt: string | null | undefined): Status {
  if (!lastSeenAt) return "never";
  const seconds = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  if (seconds < STALE_AFTER_SECONDS) return "fresh";
  if (seconds < CRITICAL_AFTER_SECONDS) return "stale";
  return "critical";
}
//-----------//

// A short "5s ago" style label.
export function formatAge(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "No readings yet";
  const seconds = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 1000);
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}
//-----------//

// A clock time such as 14:02:03 for logs and feeds.
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
//-----------//

// ON or OFF for a boolean value, a rounded number for anything else.
export function formatValue(value: number | boolean | null | undefined, isBool: boolean): string {
  if (value === null || value === undefined) return "-";
  if (isBool) return value === true || value === 1 ? "ON" : "OFF";
  return typeof value === "number" ? String(Math.round(value * 100) / 100) : String(value);
}
//-----------//

// The unit a reading is measured in. It follows the API's ThresholdPolicy:
// power is watts, and environmental depends on the zone. Actuators have no unit.
export function unitFor(zone: string, category: SensorCategory): string {
  if (category === "Power") return "W";
  if (category === "Environmental") {
    if (zone === "IT Closet") return "°C";
    if (zone === "Material Storage") return "%";
    if (zone === "Showroom Floor") return "lux";
  }
  return "";
}
//-----------//
