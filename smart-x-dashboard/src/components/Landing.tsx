import type { Route } from "../types";
import { hrefFor } from "../hooks/useHashRoute";
import { useSmartX } from "../context/SmartXContext";

interface Pillar {
  key: string;
  title: string;
  description: string;
  route: Route | null;
  statusText: string;
}

const PILLARS: Pillar[] = [
  {
    key: "ingestion",
    title: "Sensor Data Ingestion & Telemetry",
    description:
      "Register devices, stream readings, and watch live status across the showroom, material storage, workshop, and server room.",
    route: "ingestion",
    statusText: "Available in Part 1",
  },
  {
    key: "command",
    title: "Real-Time Command Stream and History",
    description:
      "Queued telemetry, manual overrides with undo, live alerts, device timelines and suggestions learned from how you work.",
    route: "command",
    statusText: "Available in Part 2",
  },
  {
    key: "topology",
    title: "Network Topology & Mesh Routing",
    description: "Visualise the mesh network and route telemetry across nodes.",
    route: null,
    statusText: "Arrives in a later phase",
  },
];

// The main menu: a live summary strip and one card per pillar.
export default function Landing() {
  const { sensors, alerts, commands, insights } = useSmartX();

  return (
    <div className="landing">
      <div className="landing-intro">
        <h1>Smart-X</h1>
        <p className="landing-lede">Studio HQ edge gateway</p>
        <p>
          A hybrid IoT console for the building systems behind Studio HQ. Environmental
          conditions, power draw, and automated actuators, all reporting back through one
          gateway.
        </p>
      </div>

      <dl className="summary-strip" aria-label="Live summary">
        <div>
          <dt>Sensors</dt>
          <dd>{sensors.length}</dd>
        </div>
        <div>
          <dt>Active alerts</dt>
          <dd className={alerts.length > 0 ? "summary-hot" : ""}>{alerts.length}</dd>
        </div>
        <div>
          <dt>Commands on the undo stack</dt>
          <dd>{commands.length}</dd>
        </div>
        <div>
          <dt>Suggestions</dt>
          <dd>{insights.length}</dd>
        </div>
      </dl>

      <div className="pillar-grid">
        {PILLARS.map((pillar) =>
          pillar.route ? (
            <a key={pillar.key} href={hrefFor(pillar.route)} className="pillar-card pillar-card--active">
              <h2>{pillar.title}</h2>
              <p>{pillar.description}</p>
              <span className="pillar-status">{pillar.statusText}</span>
            </a>
          ) : (
            <div key={pillar.key} className="pillar-card pillar-card--disabled" aria-disabled="true">
              <h2>{pillar.title}</h2>
              <p>{pillar.description}</p>
              <span className="pillar-status">{pillar.statusText}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
//-----------//
