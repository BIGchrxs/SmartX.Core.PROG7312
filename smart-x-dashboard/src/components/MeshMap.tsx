import { useMemo } from "react";
import type { MeshLink, MeshSnapshot } from "../types";

interface Props {
  mesh: MeshSnapshot;
  selectedId: string | null;
  routeLegs: MeshLink[];
  unreachable: string[];
  onSelect: (id: string) => void;
}

const WIDTH = 110;
const HEIGHT = 104;
const NODE_RADIUS: Record<string, number> = { Gateway: 4.6, Repeater: 3.4, Sensor: 2.8 };

// Builds the key used to recognise a link whichever way round its ends are given.
function linkKey(from: string, to: string): string {
  return [from.toUpperCase(), to.toUpperCase()].sort().join("|");
}
//-----------//

// Draws the mesh: every wireless link, the spanning tree picked out from the rest, and the route
// the selected node's telemetry takes back to the gateway.
export default function MeshMap({ mesh, selectedId, routeLegs, unreachable, onSelect }: Props) {
  const mstKeys = useMemo(
    () => new Set(mesh.prim.edges.map((e) => linkKey(e.from, e.to))),
    [mesh.prim.edges]
  );
  const routeKeys = useMemo(() => new Set(routeLegs.map((l) => linkKey(l.from, l.to))), [routeLegs]);
  const cutOff = useMemo(() => new Set(unreachable.map((id) => id.toUpperCase())), [unreachable]);
  const positions = useMemo(() => new Map(mesh.nodes.map((n) => [n.id.toUpperCase(), n])), [mesh.nodes]);

  return (
    <figure className="mesh-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Mesh network with ${mesh.nodes.length} nodes and ${mesh.links.length} links`}>
        {mesh.links.map((link) => {
          const a = positions.get(link.from.toUpperCase());
          const b = positions.get(link.to.toUpperCase());
          if (!a || !b) return null;

          const key = linkKey(link.from, link.to);
          const onRoute = routeKeys.has(key);
          const inTree = mstKeys.has(key);
          const dead = !a.online || !b.online;
          const classes = ["mesh-link"];
          if (dead) classes.push("mesh-link--dead");
          else if (onRoute) classes.push("mesh-link--route");
          else if (inTree) classes.push("mesh-link--tree");

          return (
            <g key={`${link.from}-${link.to}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={classes.join(" ")}>
                <title>{`${link.from} to ${link.to}, power cost ${link.cost}`}</title>
              </line>
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 0.8} className="mesh-cost" textAnchor="middle">
                {link.cost}
              </text>
            </g>
          );
        })}

        {mesh.nodes.map((node) => {
          const selected = selectedId !== null && node.id.toUpperCase() === selectedId.toUpperCase();
          const classes = ["mesh-node", `mesh-node--${node.kind.toLowerCase()}`];
          if (!node.online) classes.push("mesh-node--offline");
          else if (cutOff.has(node.id.toUpperCase())) classes.push("mesh-node--cut");
          if (selected) classes.push("mesh-node--selected");

          return (
            <g
              key={node.id}
              className={classes.join(" ")}
              role="button"
              tabIndex={0}
              aria-label={`${node.id}, ${node.kind}, ${node.online ? "online" : "powered down"}`}
              onClick={() => onSelect(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(node.id);
                }
              }}
            >
              <circle cx={node.x} cy={node.y} r={NODE_RADIUS[node.kind] ?? 2.8} className="mesh-node-dot" />
              {!node.online && (
                <text x={node.x} y={node.y + 1.3} className="mesh-node-down" textAnchor="middle">
                  x
                </text>
              )}
              <text x={node.x} y={node.y - (NODE_RADIUS[node.kind] ?? 2.8) - 1.4} className="mesh-node-label" textAnchor="middle">
                {node.id}
              </text>
              <title>{`${node.id} (${node.mac}) in ${node.zone}`}</title>
            </g>
          );
        })}
      </svg>

      <figcaption className="mesh-legend">
        <span className="mesh-key mesh-key--tree">Spanning tree link</span>
        <span className="mesh-key mesh-key--route">Selected route</span>
        <span className="mesh-key mesh-key--spare">Spare link</span>
        <span className="mesh-key mesh-key--offline">Powered down</span>
        <span className="mesh-key mesh-key--cut">Cut off</span>
      </figcaption>
    </figure>
  );
}
//-----------//
