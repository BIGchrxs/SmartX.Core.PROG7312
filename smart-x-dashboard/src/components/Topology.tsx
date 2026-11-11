import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArchiveResponse,
  BalanceProof,
  MeshNode,
  MeshSnapshot,
  RangeQueryResponse,
  RouteReport,
  TraversalResult,
} from "../types";
import {
  backfillArchive,
  getArchive,
  getBalanceProof,
  getArchiveRange,
  getMesh,
  getRoute,
  getTraversal,
  resetMesh,
  setNodePower,
} from "../api";
import { useSmartX } from "../context/SmartXContext";
import { useSessionState } from "../hooks/useSessionState";
import { usePolling } from "../hooks/usePolling";
import MeshMap from "./MeshMap";
import RoutePanel from "./RoutePanel";
import TraversalPanel from "./TraversalPanel";
import SpanningTreePanel from "./SpanningTreePanel";
import ArchivePanel from "./ArchivePanel";

const MESH_POLL_MS = 3000;
const LOOKUP_SETTLE_MS = 300;

// Turns an instant into the local text a datetime-local input expects.
function toInputValue(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
//-----------//

// Turns what the input holds back into the UTC instant the API expects.
function toIso(inputValue: string): string | null {
  if (!inputValue) return null;
  const at = new Date(inputValue);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}
//-----------//

// Pulls the message out of whatever a failed call threw.
function problemText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
//-----------//

// The Part 3 page: the mesh as a graph, how it is walked, the spanning tree that keeps it cheap to
// run, and the AVL archive behind the historical log.
export default function Topology() {
  const { sensors, alerts } = useSmartX();

  const [mesh, setMesh] = useState<MeshSnapshot | null>(null);
  const [traversal, setTraversal] = useState<TraversalResult | null>(null);
  const [route, setRoute] = useState<RouteReport | null>(null);
  const [meshProblem, setMeshProblem] = useState<string | null>(null);
  const [routeProblem, setRouteProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kept per browser tab, so the selected node, the walk and the range all survive a page switch.
  const [lookup, setLookup] = useSessionState("smartx.mesh.lookup", "");
  const [algorithm, setAlgorithm] = useSessionState<"bfs" | "dfs">("smartx.mesh.algorithm", "bfs");
  const [archiveDevice, setArchiveDevice] = useSessionState("smartx.archive.device", "");
  const [from, setFrom] = useSessionState("smartx.archive.from", "");
  const [to, setTo] = useSessionState("smartx.archive.to", "");

  const [archive, setArchive] = useState<ArchiveResponse | null>(null);
  const [rangeResult, setRangeResult] = useState<RangeQueryResponse | null>(null);
  const [proof, setProof] = useState<BalanceProof | null>(null);
  const [archiveProblem, setArchiveProblem] = useState<string | null>(null);

  const latestRoute = useRef(0);

  // Asks the API for the graph and the walk together, so the map and the reachability list agree.
  const refreshMesh = useCallback(async () => {
    const [snapshot, walk] = await Promise.allSettled([getMesh(), getTraversal("GW-CORE-00", algorithm)]);

    if (snapshot.status === "fulfilled") {
      setMesh(snapshot.value);
      setMeshProblem(null);
    } else {
      setMeshProblem(problemText(snapshot.reason, "Could not reach the API."));
    }

    if (walk.status === "fulfilled") setTraversal(walk.value);
  }, [algorithm]);
  //-----------//

  usePolling(refreshMesh, MESH_POLL_MS);

  // Looks the typed node up once the typing settles, and keeps the answer fresh while the page is open.
  const refreshRoute = useCallback(async (idOrMac: string) => {
    const wanted = idOrMac.trim();
    const request = ++latestRoute.current;

    if (!wanted) {
      setRoute(null);
      setRouteProblem(null);
      return;
    }

    try {
      const report = await getRoute(wanted);
      if (request !== latestRoute.current) return;
      setRoute(report);
      setRouteProblem(null);
    } catch (err) {
      if (request !== latestRoute.current) return;
      setRoute(null);
      setRouteProblem(problemText(err, "That node could not be found."));
    }
  }, []);
  //-----------//

  useEffect(() => {
    const timer = setTimeout(() => void refreshRoute(lookup), LOOKUP_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [lookup, refreshRoute]);

  usePolling(() => refreshRoute(lookup), MESH_POLL_MS);

  // The first registered device becomes the archive selection, so the panel is never empty on arrival.
  useEffect(() => {
    if (!archiveDevice && sensors.length > 0) setArchiveDevice(sensors[0].deviceId);
  }, [sensors, archiveDevice, setArchiveDevice]);

  // Loads the newest archived readings whenever the chosen device changes.
  useEffect(() => {
    if (!archiveDevice) return;
    let dropped = false;

    getArchive(archiveDevice, 50)
      .then((response) => {
        if (!dropped) {
          setArchive(response);
          setRangeResult(null);
          setProof(null);
          setArchiveProblem(null);
        }
      })
      .catch((err: unknown) => {
        if (!dropped) setArchiveProblem(problemText(err, "The archive could not be read."));
      });

    return () => {
      dropped = true;
    };
  }, [archiveDevice]);

  // Runs an action that changes the mesh, then reloads everything so every panel agrees.
  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
        await refreshMesh();
        await refreshRoute(lookup);
      } catch (err) {
        setMeshProblem(problemText(err, "That did not work."));
      } finally {
        setBusy(false);
      }
    },
    [refreshMesh, refreshRoute, lookup]
  );
  //-----------//

  // Powers one node down or back up.
  const handlePower = useCallback(
    (node: MeshNode, on: boolean) => void runAction(() => setNodePower(node.id, on)),
    [runAction]
  );
  //-----------//

  // Fills both ends of the range from a number of minutes back to now.
  const handleQuickRange = useCallback(
    (minutes: number) => {
      const now = new Date();
      setTo(toInputValue(now));
      setFrom(toInputValue(new Date(now.getTime() - minutes * 60 * 1000)));
    },
    [setFrom, setTo]
  );
  //-----------//

  // Asks the AVL tree for everything inside the chosen range.
  const handleRunQuery = useCallback(async () => {
    const fromIso = toIso(from);
    const toIso_ = toIso(to);

    if (!fromIso || !toIso_) {
      setArchiveProblem("Pick both ends of the range first, or use one of the quick ranges.");
      return;
    }

    setBusy(true);
    try {
      const response = await getArchiveRange(archiveDevice, fromIso, toIso_);
      setRangeResult(response);
      setArchiveProblem(null);
      setArchive(await getArchive(archiveDevice, 50));
    } catch (err) {
      setArchiveProblem(problemText(err, "The range query failed."));
    } finally {
      setBusy(false);
    }
  }, [archiveDevice, from, to]);
  //-----------//

  // Builds the same readings into an unbalanced tree, to show what balancing is worth.
  const handleCompareTrees = useCallback(async () => {
    setBusy(true);
    try {
      setProof(await getBalanceProof(archiveDevice, 2000));
      setArchiveProblem(null);
    } catch (err) {
      setArchiveProblem(problemText(err, "The comparison could not be run."));
    } finally {
      setBusy(false);
    }
  }, [archiveDevice]);
  //-----------//

  // Adds back dated readings so the tree can be shown working over a long history.
  const handleBackfill = useCallback(async () => {
    setBusy(true);
    try {
      await backfillArchive(4000);
      setArchive(await getArchive(archiveDevice, 50));
      setRangeResult(null);
      setProof(null);
      setArchiveProblem(null);
    } catch (err) {
      setArchiveProblem(problemText(err, "The archive could not be filled."));
    } finally {
      setBusy(false);
    }
  }, [archiveDevice]);
  //-----------//

  const routeLegs = useMemo(() => route?.spanning.legs ?? [], [route]);
  const liveNodes = mesh?.nodes.filter((n) => n.online).length ?? 0;

  /*
    The headline in plain words. A count of nodes tells an operator nothing on its own, so this
    leads with what is wrong and names the nodes involved, and says so plainly when nothing is.
  */
  const headline = useMemo(() => {
    if (!mesh) return "Loading the mesh.";

    const down = mesh.nodes.filter((n) => !n.online).map((n) => n.id);
    const stranded = traversal?.unreachable ?? [];
    const problems: string[] = [];

    if (down.length > 0) {
      problems.push(`${down.join(" and ")} ${down.length === 1 ? "has" : "have"} lost power`);
    }

    if (stranded.length > 0) {
      problems.push(`${stranded.join(" and ")} cannot reach the gateway`);
    }

    if (alerts.length > 0) {
      const names = Array.from(new Set(alerts.map((a) => a.deviceId)));
      problems.push(`${names.join(" and ")} ${names.length === 1 ? "has" : "have"} an open alert`);
    }

    if (problems.length === 0) {
      return `All ${mesh.nodes.length} nodes are online and every one can reach the gateway.`;
    }

    const sentence = problems.join(". ");
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  }, [mesh, traversal, alerts]);
  //-----------//

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Network Topology &amp; Mesh Routing</h1>
        <p className={mesh && (traversal?.unreachable.length ?? 0) + mesh.nodes.filter((n) => !n.online).length > 0 ? "summary-hot" : ""}>
          {headline}
        </p>
        {mesh && (
          <p className="dashboard-subline">
            {liveNodes} of {mesh.nodes.length} nodes online, {mesh.links.length} wireless links, spanning tree cost{" "}
            {mesh.prim.totalCost}
          </p>
        )}
      </header>

      {meshProblem && <div className="banner banner--error">{meshProblem}</div>}

      {mesh && (
        <>
          <section className="panel panel--wide">
            <div className="panel-head">
              <h2>Mesh network</h2>
              <span className="toolbar-note">
                Pick a node to trace how its telemetry reaches the gateway
              </span>
            </div>
            <MeshMap
              mesh={mesh}
              sensors={sensors}
              alerts={alerts}
              selectedId={route?.node.id ?? null}
              routeLegs={routeLegs}
              unreachable={traversal?.unreachable ?? []}
              onSelect={setLookup}
            />
          </section>

          <div className="stream-grid">
            <RoutePanel
              lookup={lookup}
              onLookupChange={setLookup}
              route={route}
              problem={routeProblem}
              busy={busy}
              onPower={handlePower}
            />
            <TraversalPanel
              traversal={traversal}
              algorithm={algorithm}
              onAlgorithmChange={setAlgorithm}
              onReset={() => void runAction(() => resetMesh())}
              busy={busy}
            />
          </div>

          <SpanningTreePanel mesh={mesh} />
        </>
      )}

      <ArchivePanel
        sensors={sensors}
        deviceId={archiveDevice}
        onDeviceChange={setArchiveDevice}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onQuickRange={handleQuickRange}
        onRunQuery={() => void handleRunQuery()}
        onBackfill={() => void handleBackfill()}
        archive={archive}
        result={rangeResult}
        proof={proof}
        onCompareTrees={() => void handleCompareTrees()}
        problem={archiveProblem}
        busy={busy}
      />
    </div>
  );
}
//-----------//
