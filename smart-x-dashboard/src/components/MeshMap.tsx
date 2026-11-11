import { useMemo, useState } from "react";
import type { ActiveAlert, MeshLink, MeshNode, MeshSnapshot, SensorRegistration } from "../types";
import type { Health } from "../status";
import { HEALTH_LABEL, formatAge, formatValue, getHealth, unitFor } from "../status";

interface Props {
  mesh: MeshSnapshot;
  sensors: SensorRegistration[];
  alerts: ActiveAlert[];
  selectedId: string | null;
  routeLegs: MeshLink[];
  unreachable: string[];
  onSelect: (id: string) => void;
}

/*
  The canvas is wide rather than square, matching the coordinates the API sends, so the whole mesh
  is visible at once instead of running off the bottom of the screen. The view starts outside the
  node area on every side, which leaves room for the name of a node sitting against an edge.
*/
const MARGIN_X = 9;
const MARGIN_TOP = 3;
const MARGIN_BOTTOM = 5;
const WIDTH = 100;
const HEIGHT = 48;

// How big each kind of node is drawn. The gateway is largest because everything routes back to it.
const SIZES: Record<string, number> = { Gateway: 3.4, Repeater: 2.8, Sensor: 2.4 };

// What the dashboard knows about one node, gathered from the mesh, the registry and the alerts.
interface NodeFacts {
  node: MeshNode;
  sensor?: SensorRegistration;
  health?: Health;
  reading: string;
  unit: string;
  isOn: boolean;
  cutOff: boolean;
}

// Builds the key used to recognise a link whichever way round its ends are given.
function linkKey(from: string, to: string): string {
  return [from.toUpperCase(), to.toUpperCase()].sort().join("|");
}
//-----------//

// Draws one node. Shape carries its role, so colour is free to carry how healthy it is.
function NodeShape({ node, size }: { node: MeshNode; size: number }) {
  if (node.kind === "Gateway") {
    return (
      <rect
        x={node.x - size}
        y={node.y - size}
        width={size * 2}
        height={size * 2}
        rx={size * 0.35}
        className="mesh-node-dot"
      />
    );
  }

  if (node.kind === "Repeater") {
    const points = `${node.x},${node.y - size} ${node.x + size},${node.y} ${node.x},${node.y + size} ${node.x - size},${node.y}`;
    return <polygon points={points} className="mesh-node-dot" />;
  }

  return <circle cx={node.x} cy={node.y} r={size} className="mesh-node-dot" />;
}
//-----------//

// Draws the mesh: the links, the spanning tree picked out from the rest, the route the selected
// node's telemetry takes to the gateway, and how healthy each sensor is right now.
export default function MeshMap({ mesh, sensors, alerts, selectedId, routeLegs, unreachable, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const mstKeys = useMemo(() => new Set(mesh.prim.edges.map((e) => linkKey(e.from, e.to))), [mesh.prim.edges]);
  const routeKeys = useMemo(() => new Set(routeLegs.map((l) => linkKey(l.from, l.to))), [routeLegs]);
  const cutOff = useMemo(() => new Set(unreachable.map((id) => id.toUpperCase())), [unreachable]);
  const positions = useMemo(() => new Map(mesh.nodes.map((n) => [n.id.toUpperCase(), n])), [mesh.nodes]);

  // Everything the map needs about each node, worked out once per refresh.
  const facts = useMemo(() => {
    const byId = new Map(sensors.map((s) => [s.deviceId.toUpperCase(), s]));
    const alertsFor = new Map<string, typeof alerts>();

    for (const alert of alerts) {
      const key = alert.deviceId.toUpperCase();
      alertsFor.set(key, [...(alertsFor.get(key) ?? []), alert]);
    }

    const result = new Map<string, NodeFacts>();

    for (const node of mesh.nodes) {
      const key = node.id.toUpperCase();
      const sensor = byId.get(key);
      const isBool = sensor?.valueType === "Bool";

      result.set(key, {
        node,
        sensor,
        health: sensor
          ? getHealth(sensor.lastSeenAt, (alertsFor.get(key) ?? []).map((a) => a.type))
          : undefined,
        reading: sensor ? formatValue(sensor.lastValue, isBool) : "",
        unit: sensor ? unitFor(sensor.zone, sensor.category) : "",
        isOn: isBool && (sensor?.lastValue === true || sensor?.lastValue === 1),
        cutOff: cutOff.has(key),
      });
    }

    return result;
  }, [mesh.nodes, sensors, alerts, cutOff]);

  /*
    Where each label sits. Adding up the directions of a node's links gives the side it is busiest
    on, so the label goes to the opposite side and lands in empty space instead of across a link or
    one of the cost chips. A node with no links keeps its label above it.
  */
  const labelDirections = useMemo(() => {
    const directions = new Map<string, { dx: number; dy: number }>();

    for (const node of mesh.nodes) {
      let dx = 0;
      let dy = 0;

      for (const link of mesh.links) {
        const isFrom = link.from.toUpperCase() === node.id.toUpperCase();
        const isTo = link.to.toUpperCase() === node.id.toUpperCase();
        if (!isFrom && !isTo) continue;

        const other = positions.get((isFrom ? link.to : link.from).toUpperCase());
        if (!other) continue;

        const vx = other.x - node.x;
        const vy = other.y - node.y;
        const length = Math.hypot(vx, vy) || 1;
        dx += vx / length;
        dy += vy / length;
      }

      const length = Math.hypot(dx, dy);
      directions.set(node.id.toUpperCase(), length < 0.25 ? { dx: 0, dy: -1 } : { dx: -dx / length, dy: -dy / length });
    }

    return directions;
  }, [mesh.nodes, mesh.links, positions]);

  // The node the detail strip describes: whatever is under the pointer, else whatever is selected.
  const described =
    facts.get((hovered ?? "").toUpperCase()) ??
    facts.get((selectedId ?? "").toUpperCase()) ??
    null;

  // The classes one node carries: what it is, how healthy it is, and whether the mesh can reach it.
  const nodeClasses = (fact: NodeFacts): string => {
    const classes = ["mesh-node", `mesh-node--${fact.node.kind.toLowerCase()}`];

    if (fact.health) classes.push(`mesh-node--${fact.health}`);
    if (fact.isOn) classes.push("mesh-node--switched-on");
    if (!fact.node.online) classes.push("mesh-node--offline");
    else if (fact.cutOff) classes.push("mesh-node--cut");
    if (selectedId !== null && fact.node.id.toUpperCase() === selectedId.toUpperCase()) classes.push("mesh-node--selected");

    return classes.join(" ");
  };
  //-----------//

  // Says in plain words what is wrong with a node, worst problem first.
  const stateOf = (fact: NodeFacts): string => {
    if (!fact.node.online) return "Powered down";
    if (fact.cutOff) return "No route to the gateway";
    return fact.health ? HEALTH_LABEL[fact.health] : "Online";
  };
  //-----------//

  return (
    <figure className="mesh-map">
      <svg
        viewBox={`${-MARGIN_X} ${-MARGIN_TOP} ${WIDTH + MARGIN_X * 2} ${HEIGHT + MARGIN_TOP + MARGIN_BOTTOM}`}
        role="img"
        aria-label={`Mesh network with ${mesh.nodes.length} nodes and ${mesh.links.length} wireless links`}
      >
        {mesh.links.map((link) => {
          const a = positions.get(link.from.toUpperCase());
          const b = positions.get(link.to.toUpperCase());
          if (!a || !b) return null;

          const key = linkKey(link.from, link.to);
          const dead = !a.online || !b.online;
          const onRoute = !dead && routeKeys.has(key);
          const inTree = !dead && !onRoute && mstKeys.has(key);

          const role = dead ? "dead" : onRoute ? "route" : inTree ? "tree" : "spare";
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const chipWidth = String(link.cost).length * 1.5 + 1.8;

          return (
            <g key={`${link.from}-${link.to}`} className={`mesh-edge mesh-edge--${role}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="mesh-link">
                <title>{`${link.from} to ${link.to}, power cost ${link.cost}`}</title>
              </line>
              <rect
                x={midX - chipWidth / 2}
                y={midY - 1.45}
                width={chipWidth}
                height={2.9}
                rx={0.7}
                className="mesh-cost-chip"
              />
              <text x={midX} y={midY + 0.75} className="mesh-cost" textAnchor="middle">
                {link.cost}
              </text>
            </g>
          );
        })}

        {mesh.nodes.map((node) => {
          const fact = facts.get(node.id.toUpperCase());
          if (!fact) return null;

          const size = SIZES[node.kind] ?? SIZES.Sensor;
          const selected = selectedId !== null && node.id.toUpperCase() === selectedId.toUpperCase();

          return (
            <g
              key={node.id}
              className={nodeClasses(fact)}
              role="button"
              tabIndex={0}
              aria-label={`${node.id}, ${node.kind}, ${stateOf(fact)}`}
              onClick={() => onSelect(node.id)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered((current) => (current === node.id ? null : current))}
              onFocus={() => setHovered(node.id)}
              onBlur={() => setHovered((current) => (current === node.id ? null : current))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(node.id);
                }
              }}
            >
              {selected && <circle cx={node.x} cy={node.y} r={size + 1.9} className="mesh-node-halo" />}

              <NodeShape node={node} size={size} />

              {!node.online && (
                <g className="mesh-node-cross">
                  <line x1={node.x - size * 0.5} y1={node.y - size * 0.5} x2={node.x + size * 0.5} y2={node.y + size * 0.5} />
                  <line x1={node.x + size * 0.5} y1={node.y - size * 0.5} x2={node.x - size * 0.5} y2={node.y + size * 0.5} />
                </g>
              )}
            </g>
          );
        })}

        {/* Labels go on last, so a link can never be drawn across the name of a node. */}
        {mesh.nodes.map((node) => {
          const fact = facts.get(node.id.toUpperCase());
          if (!fact) return null;

          const size = SIZES[node.kind] ?? SIZES.Sensor;
          const direction = labelDirections.get(node.id.toUpperCase()) ?? { dx: 0, dy: -1 };
          const gap = size + 1.9;
          const x = node.x + direction.dx * gap;
          const y = node.y + direction.dy * gap;
          const below = direction.dy > 0.35;
          const anchor = direction.dx > 0.35 ? "start" : direction.dx < -0.35 ? "end" : "middle";

          return (
            <g
              key={`${node.id}-label`}
              className={`mesh-label ${fact.health ? `mesh-label--${fact.health}` : ""} ${node.online ? "" : "mesh-label--offline"}`}
              onClick={() => onSelect(node.id)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered((current) => (current === node.id ? null : current))}
            >
              <text x={x} y={below ? y : y - (fact.reading ? 2.4 : 0)} className="mesh-node-label" textAnchor={anchor} dominantBaseline={below ? "hanging" : "auto"}>
                {node.id}
              </text>

              {/* The live reading sits under the name, so the map answers "how is it doing" too. */}
              {fact.reading && (
                <text x={x} y={below ? y + 2.6 : y} className="mesh-node-value" textAnchor={anchor} dominantBaseline={below ? "hanging" : "auto"}>
                  {fact.reading}
                  {fact.unit ? ` ${fact.unit}` : ""}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="mesh-caption">
        <div className="mesh-legend-set" aria-hidden="true">
          <div className="mesh-legend">
            <span className="mesh-legend-title">Sensor health</span>
            <span className="mesh-key mesh-key--normal">Healthy</span>
            <span className="mesh-key mesh-key--warning">Out of range</span>
            <span className="mesh-key mesh-key--critical">Critical</span>
            <span className="mesh-key mesh-key--silent">Not reporting</span>
            <span className="mesh-key mesh-key--unknown">No readings</span>
            <span className="mesh-key mesh-key--on">Switched on</span>
          </div>

          <div className="mesh-legend">
            <span className="mesh-legend-title">Network</span>
            <span className="mesh-key mesh-key--gateway">Gateway</span>
            <span className="mesh-key mesh-key--repeater">Repeater</span>
            <span className="mesh-key mesh-key--route">Selected route</span>
            <span className="mesh-key mesh-key--tree">Spanning tree</span>
            <span className="mesh-key mesh-key--spare">Spare link</span>
          </div>
        </div>

        <p className="mesh-detail">
          {described ? (
            <>
              <strong>{described.node.id}</strong>
              <span className="mesh-detail-mac">{described.node.mac}</span>
              <span>{described.node.zone}</span>
              {described.sensor && <span>{formatAge(described.sensor.lastSeenAt)}</span>}
              <span className={`mesh-detail-state mesh-detail-state--${described.node.online && !described.cutOff ? described.health ?? "normal" : "critical"}`}>
                {stateOf(described)}
              </span>
            </>
          ) : (
            <span>Hover a node for its hardware address and last reading. Click one to trace its route.</span>
          )}
        </p>
      </figcaption>
    </figure>
  );
}
//-----------//
