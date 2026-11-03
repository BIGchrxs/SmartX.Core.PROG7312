import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  ActiveAlert,
  AlertEvent,
  CommandEntry,
  Insight,
  QueueStatus,
  RecentReading,
  SensorRegistration,
} from "../types";
import {
  getActiveAlerts,
  getAlertEvents,
  getCommandHistory,
  getInsights,
  getQueueStatus,
  getRecent,
  listSensors,
} from "../api";
import { usePolling } from "../hooks/usePolling";

const POLL_INTERVAL_MS = 2000;
const REFRESH_AFTER_SEND_MS = 350;

interface SmartXValue {
  sensors: SensorRegistration[];
  alerts: ActiveAlert[];
  alertEvents: AlertEvent[];
  raisedTotal: number;
  duplicatesIgnored: number;
  insights: Insight[];
  commands: CommandEntry[];
  canUndo: boolean;
  queue: QueueStatus | null;
  recent: RecentReading[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshSoon: () => void;
}

const SmartXContext = createContext<SmartXValue | null>(null);

// Turns a failed promise reason into text for the error banner.
function reasonText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Could not reach the API.";
}
//-----------//

// Holds everything the pages share. It sits above the pages, so switching pages never loses the data.
export function SmartXProvider({ children }: { children: ReactNode }) {
  const [sensors, setSensors] = useState<SensorRegistration[]>([]);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [raisedTotal, setRaisedTotal] = useState(0);
  const [duplicatesIgnored, setDuplicatesIgnored] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [commands, setCommands] = useState<CommandEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [recent, setRecent] = useState<RecentReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Asks the API for everything at once. One failing call does not wipe the others.
  const refresh = useCallback(async () => {
    const [s, a, i, c, q, r, e] = await Promise.allSettled([
      listSensors(),
      getActiveAlerts(),
      getInsights(),
      getCommandHistory(),
      getQueueStatus(),
      getRecent(25),
      getAlertEvents(20),
    ]);

    let failure: string | null = null;

    if (s.status === "fulfilled") setSensors(s.value);
    else failure = reasonText(s.reason);

    if (a.status === "fulfilled") setAlerts(a.value.alerts);
    else failure ??= reasonText(a.reason);

    if (i.status === "fulfilled") setInsights(i.value.insights);
    else failure ??= reasonText(i.reason);

    if (c.status === "fulfilled") {
      setCommands(c.value.commands);
      setCanUndo(c.value.canUndo);
    } else failure ??= reasonText(c.reason);

    if (q.status === "fulfilled") setQueue(q.value);
    else failure ??= reasonText(q.reason);

    if (r.status === "fulfilled") setRecent(r.value);
    else failure ??= reasonText(r.reason);

    if (e.status === "fulfilled") {
      setAlertEvents(e.value.events);
      setRaisedTotal(e.value.raisedTotal);
      setDuplicatesIgnored(e.value.duplicatesIgnored);
    } else failure ??= reasonText(e.reason);

    setError(failure);
    setLoading(false);
  }, []);
  //-----------//

  // Readings are processed in the background, so a refresh right after a send waits a moment first.
  const refreshSoon = useCallback(() => {
    window.setTimeout(() => void refresh(), REFRESH_AFTER_SEND_MS);
  }, [refresh]);
  //-----------//

  usePolling(refresh, POLL_INTERVAL_MS);

  const value = useMemo<SmartXValue>(
    () => ({
      sensors,
      alerts,
      alertEvents,
      raisedTotal,
      duplicatesIgnored,
      insights,
      commands,
      canUndo,
      queue,
      recent,
      loading,
      error,
      refresh,
      refreshSoon,
    }),
    [sensors, alerts, alertEvents, raisedTotal, duplicatesIgnored, insights, commands, canUndo, queue, recent, loading, error, refresh, refreshSoon]
  );

  return <SmartXContext.Provider value={value}>{children}</SmartXContext.Provider>;
}
//-----------//

// Gives a component the shared state. Throws if it is used outside the provider.
export function useSmartX(): SmartXValue {
  const value = useContext(SmartXContext);
  if (!value) throw new Error("useSmartX must be used inside SmartXProvider.");
  return value;
}
//-----------//
