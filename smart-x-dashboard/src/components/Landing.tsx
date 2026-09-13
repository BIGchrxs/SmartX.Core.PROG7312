interface Props {
  onEnterIngestion: () => void;
}

interface Pillar {
  key: string;
  title: string;
  description: string;
  active: boolean;
}

const PILLARS: Pillar[] = [
  {
    key: "ingestion",
    title: "Sensor Data Ingestion & Telemetry",
    description:
      "Register devices, stream readings, and watch live status across the showroom, material storage, workshop, and server room.",
    active: true,
  },
  {
    key: "command",
    title: "Real-Time Processing and Device Management",
    description: "Send commands to actuators and review historical event timelines.",
    active: false,
  },
  {
    key: "topology",
    title: "Network Topology & Mesh Routing",
    description: "Visualise the mesh network and route telemetry across nodes.",
    active: false,
  },
];

export default function Landing({ onEnterIngestion }: Props) {
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

      <div className="pillar-grid">
        {PILLARS.map((pillar) => (
          <button
            key={pillar.key}
            type="button"
            className={`pillar-card ${pillar.active ? "pillar-card--active" : "pillar-card--disabled"}`}
            onClick={pillar.active ? onEnterIngestion : undefined}
            disabled={!pillar.active}
          >
            <h2>{pillar.title}</h2>
            <p>{pillar.description}</p>
            <span className="pillar-status">
              {pillar.active ? "Available in Part 1" : "Arrives in a later phase"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}