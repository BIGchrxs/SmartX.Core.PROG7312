import { useEffect, useMemo, useRef, useState } from "react";
import type { Insight, SensorRegistration } from "../types";
import { logSearch, sendCommand, undoCommand } from "../api";
import { useSmartX } from "../context/SmartXContext";
import { useSessionState } from "../hooks/useSessionState";
import InsightsPanel from "./InsightsPanel";
import AlertsList from "./AlertsList";
import QueuePanel from "./QueuePanel";
import CommandPanel from "./CommandPanel";
import LiveFeed from "./LiveFeed";
import TimelineChart from "./TimelineChart";

const SEARCH_SETTLE_MS = 1000;

// True when the search term appears in the device ID, zone or category (ignoring case).
function matches(sensor: SensorRegistration, term: string): boolean {
  if (!term) return true;
  const needle = term.toLowerCase();
  return (
    sensor.deviceId.toLowerCase().includes(needle) ||
    sensor.zone.toLowerCase().includes(needle) ||
    sensor.category.toLowerCase().includes(needle)
  );
}
//-----------//

// The Part 2 page: insights, alerts, queues, manual overrides with undo, a live feed and device timelines.
export default function CommandStream() {
  const { sensors, alerts, insights, commands, canUndo, queue, recent, error, refresh } = useSmartX();

  // The search box and the chosen timeline device are kept per tab, so they survive page switches and refreshes.
  const [search, setSearch] = useSessionState("smartx.search", "");
  const [selected, setSelected] = useSessionState("smartx.device", "");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastLogged = useRef(search.trim().toLowerCase());

  // Once typing settles, tell the API what was searched so it can learn which searches you repeat.
  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2 || term === lastLogged.current) return;

    const timer = setTimeout(() => {
      lastLogged.current = term;
      logSearch(term).catch(() => {
        // Logging is best effort, so a failure never interrupts the operator.
      });
    }, SEARCH_SETTLE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => sensors.filter((s) => matches(s, search.trim())), [sensors, search]);
  const actuators = useMemo(() => filtered.filter((s) => s.category === "Actuator"), [filtered]);
  const boolDevices = useMemo(
    () => new Set(sensors.filter((s) => s.valueType === "Bool").map((s) => s.deviceId)),
    [sensors]
  );
  const visibleRecent = useMemo(() => {
    const ids = new Set(filtered.map((s) => s.deviceId));
    return recent.filter((r) => ids.has(r.deviceId));
  }, [filtered, recent]);

  // The timeline falls back to the first matching device when the saved choice is filtered out.
  const activeDevice = filtered.find((s) => s.deviceId === selected)?.deviceId ?? filtered[0]?.deviceId ?? null;

  // Runs a command-style action, then reloads everything so the panels agree.
  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }
  //-----------//

  // Switches an actuator on or off.
  function handleCommand(deviceId: string, on: boolean) {
    void runAction(() => sendCommand(deviceId, on));
  }
  //-----------//

  // Pops the undo stack.
  function handleUndo() {
    void runAction(() => undoCommand());
  }
  //-----------//

  // Runs the command a suggestion proposed, tagged so the log shows it came from a suggestion.
  function handleApply(insight: Insight) {
    const command = insight.command;
    if (!command) return;
    void runAction(() => sendCommand(command.deviceId, command.on, "suggestion"));
  }
  //-----------//

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Real-Time Command Stream and History</h1>
        <p>
          {sensors.length} device{sensors.length === 1 ? "" : "s"}, {alerts.length} active alert
          {alerts.length === 1 ? "" : "s"}, {commands.length} command{commands.length === 1 ? "" : "s"} on the undo stack
        </p>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      <div className="toolbar">
        <label className="field">
          Search devices
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Try: crac, humidity, workshop"
          />
        </label>
        <span className="toolbar-note">
          Showing {filtered.length} of {sensors.length} devices
        </span>
      </div>

      <InsightsPanel
        insights={insights}
        busy={busy}
        onApplyCommand={handleApply}
        onUseSearch={setSearch}
        onRefresh={refresh}
      />

      <div className="stream-grid">
        <AlertsList alerts={alerts} />
        <QueuePanel status={queue} />
        <CommandPanel
          actuators={actuators}
          commands={commands}
          canUndo={canUndo}
          busy={busy}
          message={message}
          onCommand={handleCommand}
          onUndo={handleUndo}
        />
        <LiveFeed readings={visibleRecent} boolDevices={boolDevices} />
      </div>

      <section className="panel panel--wide">
        <div className="panel-head">
          <h2>Device timeline</h2>
          <label className="field field--inline">
            Device
            <select value={activeDevice ?? ""} onChange={(e) => setSelected(e.target.value)} disabled={filtered.length === 0}>
              {filtered.map((s) => (
                <option key={s.deviceId} value={s.deviceId}>
                  {s.deviceId} ({s.zone})
                </option>
              ))}
            </select>
          </label>
        </div>
        <TimelineChart deviceId={activeDevice} isBool={activeDevice !== null && boolDevices.has(activeDevice)} />
      </section>
    </div>
  );
}
//-----------//
