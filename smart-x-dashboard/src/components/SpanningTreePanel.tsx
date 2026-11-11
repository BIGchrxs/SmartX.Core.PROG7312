import type { MeshSnapshot } from "../types";

interface Props {
  mesh: MeshSnapshot;
}

// Shows both spanning tree algorithms side by side, and the links the tree chose to keep.
export default function SpanningTreePanel({ mesh }: Props) {
  const { prim, kruskal } = mesh;
  const spareLinks = mesh.links.length - prim.edges.length;

  return (
    <section className="panel panel--wide">
      <h2>Minimum spanning tree</h2>

      <p className="panel-note">
        The spanning tree is the cheapest set of links that still joins every node to the gateway. Keeping only
        these radios awake is what makes the mesh power efficient. Two different algorithms are run over the same
        graph as a check on each other.
      </p>

      <div className="mst-compare">
        <div className={`mst-card ${mesh.algorithmsAgree ? "mst-card--agreed" : "mst-card--differs"}`}>
          <h3>{prim.algorithm}</h3>
          <p className="mst-total">{prim.totalCost}</p>
          <p className="mst-detail">
            {prim.edges.length} links, {prim.queueOperations} heap operations, {prim.elapsedTicks} ticks
          </p>
        </div>
        <div className={`mst-card ${mesh.algorithmsAgree ? "mst-card--agreed" : "mst-card--differs"}`}>
          <h3>{kruskal.algorithm}</h3>
          <p className="mst-total">{kruskal.totalCost}</p>
          <p className="mst-detail">
            {kruskal.edges.length} links, {kruskal.queueOperations} edges considered, {kruskal.elapsedTicks} ticks
          </p>
        </div>
      </div>

      <p className={`panel-note ${mesh.algorithmsAgree ? "" : "sensor-problem"}`}>
        {mesh.algorithmsAgree
          ? `Both algorithms reached a total of ${prim.totalCost} over ${prim.edges.length} links, which is a strong sign the tree is right. ${spareLinks} spare link${spareLinks === 1 ? "" : "s"} stay available for healing when a node fails.`
          : "The two algorithms disagree, which should never happen on the same connected graph."}
      </p>

      {!prim.spansWholeNetwork && (
        <p className="sensor-problem">
          The tree does not reach every node. Part of the mesh has been cut off by a power failure.
        </p>
      )}

      <h3 className="subhead">
        Links kept <span className="count-pill">{prim.edges.length}</span>
      </h3>
      <ul className="history-list history-list--columns">
        {prim.edges.map((edge) => (
          <li key={`${edge.from}-${edge.to}`} className="history-row">
            <span className="hop-cost">{edge.cost}</span>
            <strong>{edge.from}</strong>
            <span className="feed-zone">to {edge.to}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
//-----------//
