import type { CommandEntry, SensorRegistration } from "../types";
import { formatClock, formatValue } from "../status";

interface Props {
  actuators: SensorRegistration[];
  commands: CommandEntry[];
  canUndo: boolean;
  busy: boolean;
  message: string | null;
  onCommand: (deviceId: string, on: boolean) => void;
  onUndo: () => void;
}

// Manual overrides for the on/off actuators, plus the undo stack (newest command on top).
export default function CommandPanel({ actuators, commands, canUndo, busy, message, onCommand, onUndo }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Manual override</h2>
        <button type="button" className="btn-ghost" onClick={onUndo} disabled={busy || !canUndo}>
          Undo last command
        </button>
      </div>

      {message && <div className="banner banner--error">{message}</div>}

      {actuators.length === 0 ? (
        <p className="empty-state">No actuators match. Clear the search box to see them all.</p>
      ) : (
        <ul className="row-list">
          {actuators.map((actuator) => {
            const on = actuator.lastValue === true;
            return (
              <li key={actuator.deviceId} className="row">
                <div className="row-main">
                  <strong>{actuator.deviceId}</strong>
                  <span className="row-tag">{actuator.zone}</span>
                  <span className={`state-chip state-chip--${on ? "on" : "off"}`}>
                    {formatValue(actuator.lastValue, true)}
                  </span>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn-ghost" disabled={busy || on} onClick={() => onCommand(actuator.deviceId, true)}>
                    Turn on
                  </button>
                  <button type="button" className="btn-ghost" disabled={busy || !on} onClick={() => onCommand(actuator.deviceId, false)}>
                    Turn off
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="subhead">
        Undo stack <span className="count-pill">{commands.length}</span>
      </h3>
      {commands.length === 0 ? (
        <p className="panel-note">No commands yet. The newest command sits on top and is the one Undo reverses.</p>
      ) : (
        <ol className="stack-list">
          {commands.slice(0, 8).map((command, index) => (
            <li key={command.id} className={index === 0 ? "stack-top" : ""}>
              <span className="row-time">{formatClock(command.timestamp)}</span>
              <span>
                {command.deviceId} {command.previousState ? "ON" : "OFF"} &rarr; {command.newState ? "ON" : "OFF"}
              </span>
              <span className="row-tag">{command.source}</span>
              {index === 0 && <span className="row-tag row-tag--accent">next undo</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
//-----------//
