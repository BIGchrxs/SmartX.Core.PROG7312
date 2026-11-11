import type { MeshNode, RouteReport } from "../types";

interface Props {
  lookup: string;
  onLookupChange: (value: string) => void;
  route: RouteReport | null;
  problem: string | null;
  busy: boolean;
  onPower: (node: MeshNode, on: boolean) => void;
}

// Draws one route as a chain of hops with the power each leg costs.
function HopChain({ hops, legs }: { hops: string[]; legs: { cost: number }[] }) {
  return (
    <ol className="hop-chain">
      {hops.map((hop, index) => (
        <li key={`${hop}-${index}`} className="hop">
          <span className="hop-name">{hop}</span>
          {index < legs.length && <span className="hop-cost">{legs[index].cost}</span>}
        </li>
      ))}
    </ol>
  );
}
//-----------//

// The node inspector: find a node by ID or MAC address, see how its telemetry gets home, power it down.
export default function RoutePanel({ lookup, onLookupChange, route, problem, busy, onPower }: Props) {
  const node = route?.node ?? null;

  return (
    <section className="panel">
      <h2>Routing path</h2>

      <label className="field">
        Device ID or MAC address
        <input
          type="text"
          value={lookup}
          onChange={(e) => onLookupChange(e.target.value)}
          placeholder="Try: MS-DEHUM-01 or 24:6F:28:C3:6D:02"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <p className="panel-note">
        Telemetry hops from node to node until it reaches the gateway. The spanning tree route is the one the
        mesh uses when every node keeps only its tree links powered. The cheapest route is the best this one
        node could do on its own.
      </p>

      {problem && <p className="sensor-problem">{problem}</p>}

      {!route && !problem && <p className="empty-state">Pick a node on the map, or type an ID or MAC address.</p>}

      {route && node && (
        <>
          <dl className="lookup-grid">
            <div>
              <dt>Node</dt>
              <dd>{node.id}</dd>
            </div>
            <div>
              <dt>MAC address</dt>
              <dd>{node.mac}</dd>
            </div>
            <div>
              <dt>Zone and role</dt>
              <dd>
                {node.zone}, {node.kind}
              </dd>
            </div>
            <div>
              <dt>Power</dt>
              <dd className={node.online ? "" : "summary-hot"}>{node.online ? "Online" : "Powered down"}</dd>
            </div>
          </dl>

          <div className="row-actions panel-note">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy || node.kind === "Gateway"}
              onClick={() => onPower(node, !node.online)}
            >
              {node.online ? "Simulate a power failure" : "Bring this node back"}
            </button>
          </div>

          {!route.spanning.reachable && !route.cheapest.reachable ? (
            <p className="empty-state">
              {node.online
                ? "This node is cut off. Every path back to the gateway runs through a node that has lost power."
                : "This node has lost power, so it has no route home."}
            </p>
          ) : (
            <>
              <h3 className="subhead">
                Spanning tree hops <span className="count-pill">{route.spanning.totalCost}</span>
              </h3>
              <HopChain hops={route.spanning.hops} legs={route.spanning.legs} />

              <h3 className="subhead">
                Cheapest route for this node <span className="count-pill">{route.cheapest.totalCost}</span>
              </h3>
              <HopChain hops={route.cheapest.hops} legs={route.cheapest.legs} />

              <p className="panel-note">
                {route.spanningCostsMore
                  ? `The tree route costs ${route.spanning.totalCost} against ${route.cheapest.totalCost} for this node alone. The spanning tree keeps the power of the whole network as low as possible, so one node can be asked to take a longer way round.`
                  : "For this node both routes agree, so its own cheapest path is already a spanning tree path."}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
//-----------//
