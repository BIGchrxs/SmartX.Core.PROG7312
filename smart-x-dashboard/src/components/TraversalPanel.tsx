import type { TraversalResult } from "../types";

interface Props {
  traversal: TraversalResult | null;
  algorithm: "bfs" | "dfs";
  onAlgorithmChange: (value: "bfs" | "dfs") => void;
  onReset: () => void;
  busy: boolean;
}

// Walks the mesh from the gateway and reports what it reaches, what is cut off and what has no power.
export default function TraversalPanel({ traversal, algorithm, onAlgorithmChange, onReset, busy }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Who can reach the gateway</h2>
        <div className="row-actions">
          <button
            type="button"
            className={algorithm === "bfs" ? "btn-primary" : "btn-ghost"}
            onClick={() => onAlgorithmChange("bfs")}
          >
            Breadth first
          </button>
          <button
            type="button"
            className={algorithm === "dfs" ? "btn-primary" : "btn-ghost"}
            onClick={() => onAlgorithmChange("dfs")}
          >
            Depth first
          </button>
        </div>
      </div>

      <p className="panel-note">
        {algorithm === "bfs"
          ? "Breadth first search clears everything one hop away before moving further out, so the order it produces is also the order of fewest hops from the gateway."
          : "Depth first search follows one branch as far as it goes before backing up, which is the cheaper walk when the only question is whether a node can be reached."}
      </p>

      {!traversal ? (
        <p className="empty-state">Waiting for the API.</p>
      ) : (
        <>
          <dl className="stat-grid">
            <div>
              <dt>Reached</dt>
              <dd>{traversal.order.length}</dd>
            </div>
            <div>
              <dt>Cut off</dt>
              <dd className={traversal.unreachable.length > 0 ? "summary-hot" : ""}>{traversal.unreachable.length}</dd>
            </div>
            <div>
              <dt>Powered down</dt>
              <dd>{traversal.offline.length}</dd>
            </div>
            <div>
              <dt>Links examined</dt>
              <dd>{traversal.edgesExamined}</dd>
            </div>
          </dl>

          <h3 className="subhead">Visit order</h3>
          <ol className="hop-chain hop-chain--wrap">
            {traversal.order.map((id, index) => (
              <li key={id} className="hop">
                <span className="hop-index">{index + 1}</span>
                <span className="hop-name">{id}</span>
              </li>
            ))}
          </ol>

          {traversal.unreachable.length > 0 && (
            <>
              <h3 className="subhead">Cut off from the gateway</h3>
              <ul className="row-list">
                {traversal.unreachable.map((id) => (
                  <li key={id} className="row row--critical">
                    <div className="row-main">
                      <strong>{id}</strong>
                      <span className="row-tag">No route home</span>
                    </div>
                    <p className="row-text">
                      This node still has power, but every path to the gateway runs through a node that does not.
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {traversal.offline.length > 0 && (
            <div className="row-actions panel-note">
              <span className="toolbar-note">Powered down: {traversal.offline.join(", ")}</span>
              <button type="button" className="btn-ghost" onClick={onReset} disabled={busy}>
                Restore the whole mesh
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
//-----------//
