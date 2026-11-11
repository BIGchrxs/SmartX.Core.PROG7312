import type { ArchiveResponse, BalanceProof, RangeQueryResponse, SensorRegistration } from "../types";
import { unitFor } from "../status";

interface Props {
  sensors: SensorRegistration[];
  deviceId: string;
  onDeviceChange: (value: string) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onQuickRange: (minutes: number) => void;
  onRunQuery: () => void;
  onBackfill: () => void;
  archive: ArchiveResponse | null;
  result: RangeQueryResponse | null;
  proof: BalanceProof | null;
  onCompareTrees: () => void;
  problem: string | null;
  busy: boolean;
}

// A date and a time, since the archive spans hours rather than the few minutes the live feed covers.
function formatStamp(iso: string): string {
  const at = new Date(iso);
  return `${at.toLocaleDateString([], { day: "2-digit", month: "short" })} ${at.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}
//-----------//

// The AVL archive: how balanced the tree is, a range query over it, and what that query cost.
export default function ArchivePanel({
  sensors,
  deviceId,
  onDeviceChange,
  from,
  to,
  onFromChange,
  onToChange,
  onQuickRange,
  onRunQuery,
  onBackfill,
  archive,
  result,
  proof,
  onCompareTrees,
  problem,
  busy,
}: Props) {
  const sensor = sensors.find((s) => s.deviceId === deviceId);
  const unit = sensor ? unitFor(sensor.zone, sensor.category) : "";
  const stats = archive?.stats;
  const report = result?.report;
  // How many times more readings a plain scan had to look at than the tree walk did.
  const saving = report && report.treeNodesVisited > 0 ? Math.round(report.listItemsScanned / report.treeNodesVisited) : 0;

  return (
    <section className="panel panel--wide">
      <div className="panel-head">
        <h2>Historical log and range query</h2>
        <button type="button" className="btn-ghost" onClick={onBackfill} disabled={busy}>
          Load a long history
        </button>
      </div>

      <p className="panel-note">
        Every device has its own AVL tree keyed by timestamp. A range query walks down to the start of the range
        and reads across, skipping any branch that cannot hold a match, so the work grows with the size of the
        answer rather than the size of the history.
      </p>

      <div className="toolbar toolbar--archive">
        <label className="field">
          Device
          <select value={deviceId} onChange={(e) => onDeviceChange(e.target.value)}>
            {sensors.map((s) => (
              <option key={s.deviceId} value={s.deviceId}>
                {s.deviceId} ({s.zone})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          From
          <input type="datetime-local" value={from} onChange={(e) => onFromChange(e.target.value)} />
        </label>
        <label className="field">
          To
          <input type="datetime-local" value={to} onChange={(e) => onToChange(e.target.value)} />
        </label>
        <div className="row-actions">
          <button type="button" className="btn-primary" onClick={onRunQuery} disabled={busy || !deviceId}>
            Run range query
          </button>
        </div>
      </div>

      <div className="row-actions panel-note">
        <span className="toolbar-note">Quick ranges:</span>
        <button type="button" className="btn-ghost" onClick={() => onQuickRange(15)} disabled={busy}>
          Last 15 minutes
        </button>
        <button type="button" className="btn-ghost" onClick={() => onQuickRange(60)} disabled={busy}>
          Last hour
        </button>
        <button type="button" className="btn-ghost" onClick={() => onQuickRange(360)} disabled={busy}>
          Last 6 hours
        </button>
      </div>

      {problem && <p className="sensor-problem">{problem}</p>}

      {stats && (
        <>
          <h3 className="subhead">The tree behind this device</h3>
          <dl className="stat-grid stat-grid--wide">
            <div>
              <dt>Readings archived</dt>
              <dd>{stats.archived.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Tree height</dt>
              <dd>
                {stats.height}
                <span className="stat-sub"> ideal {stats.idealHeight}</span>
              </dd>
            </div>
            <div>
              <dt>Rotations to stay balanced</dt>
              <dd>{stats.rotations.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Balanced</dt>
              <dd className={stats.balanced ? "" : "summary-hot"}>{stats.balanced ? "Yes" : "No"}</dd>
            </div>
          </dl>
          <p className="panel-note">
            A balanced tree of {stats.archived.toLocaleString()} readings is {stats.height} levels deep, so finding
            any point in the history takes at most {stats.height} comparisons. An unsorted list of the same readings
            would take up to {stats.archived.toLocaleString()}.
          </p>

          <div className="row-actions panel-note">
            <button type="button" className="btn-ghost" onClick={onCompareTrees} disabled={busy || stats.archived === 0}>
              Compare with an unbalanced tree
            </button>
            <span className="toolbar-note">Why this archive balances itself</span>
          </div>

          {proof && proof.sampled > 0 && (
            <>
              <div className="mst-compare">
                <div className="mst-card mst-card--agreed">
                  <h3>AVL tree, self balancing</h3>
                  <p className="mst-total">{proof.avlHeight}</p>
                  <p className="mst-detail">
                    levels deep, after {proof.rotations.toLocaleString()} rotations
                  </p>
                </div>
                <div className="mst-card mst-card--differs">
                  <h3>Plain tree, no balancing</h3>
                  <p className="mst-total">{proof.unbalancedHeight.toLocaleString()}</p>
                  <p className="mst-detail">levels deep, from the same {proof.sampled.toLocaleString()} readings</p>
                </div>
              </div>
              <p className="panel-note">
                Timestamps only ever go up, which is the worst case for a tree that does not balance: every reading
                lands on the right of the one before it, so the tree collapses into a list. Finding the newest of
                these {proof.sampled.toLocaleString()} readings costs {proof.unbalancedComparisons.toLocaleString()}{" "}
                comparisons without balancing and {proof.avlComparisons} with it, which is {proof.timesDeeper} times
                shallower.
              </p>
            </>
          )}
        </>
      )}

      {report && (
        <>
          <h3 className="subhead">
            What that query cost <span className="count-pill">{report.matches} matched</span>
          </h3>
          <dl className="stat-grid stat-grid--wide">
            <div>
              <dt>Tree nodes visited</dt>
              <dd>{report.treeNodesVisited.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Readings a plain scan looked at</dt>
              <dd>{report.listItemsScanned.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Work saved</dt>
              <dd>{saving > 1 ? `${saving} times less` : "About the same"}</dd>
            </div>
            <div>
              <dt>Both answers match</dt>
              <dd className={report.answersMatch ? "" : "summary-hot"}>{report.answersMatch ? "Yes" : "No"}</dd>
            </div>
          </dl>
          <p className="panel-note">
            The same range was asked of the tree and of an unsorted list holding identical readings. Both returned{" "}
            {report.matches} reading{report.matches === 1 ? "" : "s"}, but the tree reached them after looking at{" "}
            {report.treeNodesVisited} node{report.treeNodesVisited === 1 ? "" : "s"} while the list had to examine
            all {report.listItemsScanned.toLocaleString()} of its entries.
          </p>
        </>
      )}

      <h3 className="subhead">
        Readings returned{" "}
        <span className="count-pill">{result ? result.count : archive ? archive.count : 0}</span>
      </h3>

      {(result ? result.points : archive?.points ?? []).length === 0 ? (
        <p className="empty-state">
          No readings in the archive for this range. Try a wider range, or load a long history first.
        </p>
      ) : (
        <ul className="feed-list">
          {(result ? result.points : archive?.points ?? []).map((point, index) => (
            <li key={`${point.timestamp}-${index}`} className={`feed-row feed-row--${point.severity.toLowerCase()}`}>
              <span className="row-time">{formatStamp(point.timestamp)}</span>
              <span className="feed-zone">{deviceId}</span>
              <span className="feed-value">{Math.round(point.value * 100) / 100}</span>
              <span className="feed-unit">{unit}</span>
              {point.severity !== "Normal" && <span className="row-tag">{point.severity}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
//-----------//
