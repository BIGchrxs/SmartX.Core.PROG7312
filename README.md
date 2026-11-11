# Smart-X IoT Gateway

Smart-X is a hybrid IoT gateway for **Studio HQ**, an interior design and architecture studio. It monitors the building systems behind the studio: environmental conditions, power draw and automated actuators across four zones: **Showroom Floor**, **Material Storage**, **Workshop** and **IT Closet**.

- **Part 1** is the ingestion pipeline and the dashboard for registering sensors and watching their status live.
- **Part 2** adds the **Real-Time Command Stream and History** pillar: queued ingestion, a priority lane for critical readings, manual overrides with undo, live alerts, sorted device timelines and a suggestion engine that learns from how the operator works.
- **Part 3** adds the **Network Topology and Mesh Routing** pillar: the mesh as a weighted graph, breadth and depth first traversals that show which nodes can still reach the gateway, Prim's and Kruskal's minimum spanning trees for power efficient routing, and an AVL tree archive that answers range queries over a long telemetry history.

All three pillars are live and run inside one application.

> Demo video: ADD YOUR YOUTUBE LINK HERE BEFORE SUBMITTING

## Contents

1. [Repository structure](#repository-structure)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup and running](#setup-and-running)
5. [Using the app](#using-the-app)
6. [How Part 2 works](#how-part-2-works)
7. [How Part 3 works](#how-part-3-works) (including [reading the map](#reading-the-map))
8. [Data structure explanations](#data-structure-explanations)
9. [Testing guide](#testing-guide)
10. [API reference](#api-reference)
11. [Thresholds](#thresholds)
12. [Simulator scenarios](#simulator-scenarios)
13. [Security notes](#security-notes)
14. [Docker](#docker)
15. [Tech stack](#tech-stack)
16. [Written submissions](#written-submissions)

---

## Repository structure

| Folder | Purpose |
| --- | --- |
| `SmartX.Core.PROG7312/` | A standalone console app that proves the core C# requirements in isolation: generics (`TelemetryPacket<T>`), operator overloading (`SensorReading`), recursion (`DeviceNode`) and jagged arrays feeding a `List<T>` (`TelemetryBuffer<T>`). It is a scaffolding step and not part of the submitted application. |
| `SmartX.Api/` | The backend: an ASP.NET Core Minimal API with the queues, stack, dictionaries, sets, suggestion engine, mesh graph and AVL archive. |
| `smart-x-dashboard/` | The frontend: a React and TypeScript single page app. |
| `simulator/` | A Node script that behaves like physical devices and sends plain HTTP requests to the API. |
| `docker-compose.yml` | Starts the API, the dashboard and the simulator together with one command. |
| `docs/` | The written submissions: the project completion report with technology recommendations, and the ledger of updates made in response to marker feedback. Both are provided as Markdown and as PDF. |

Inside `SmartX.Api/`:

| Folder | Contents |
| --- | --- |
| `Models/` | Records and enums (`QueuedReading`, `CommandEntry`, `ActiveAlert`, `Insight`, `MeshNode`, `MeshLink` and so on). |
| `Structures/` | The data structures written from scratch for Part 3: `AvlTree`, `DisjointSet` and `UnbalancedBst`. |
| `Services/` | The logic: `IngestionQueue`, `TelemetryProcessor`, `DisconnectMonitor`, `CommandService`, `TelemetryHistory`, `TelemetryArchive`, `AlertTracker`, `ActivityLog`, `InsightEngine`, `ThresholdPolicy`, `SensorRegistry`, `MeshNetwork`, `MacAddressPolicy`. |
| `Endpoints/` | The routes, one class per area (`TelemetryEndpoints`, `CommandEndpoints`, `AlertEndpoints`, `InsightEndpoints`, `TopologyEndpoints`). |

---

## Architecture

```text
simulator (Node)  ----\
                       \
Browser                 \
   |                     \
smart-x-dashboard (React + Vite, http://localhost:5173)
   |  fetch("/api/...")
Vite dev server proxy (forwards /api/* to :5067 and strips the /api prefix)
   |
SmartX.Api (ASP.NET Core Minimal API, http://localhost:5067)
   |
   |-- POST /telemetry --> IngestionQueue
   |                         |-- Queue<T>           (normal readings, FIFO)
   |                         `-- PriorityQueue<T>   (warning and critical readings)
   |                                  |
   |                         TelemetryProcessor (background worker)
   |                                  |
   |            TelemetryHistory, AlertTracker, SensorRegistry buffers
   |
   |                                  |
   |                         TelemetryArchive (AVL tree per device, deep history)
   |
   |-- DisconnectMonitor (background worker, checks for silent devices)
   |-- CommandService (Stack<T> for undo)
   |-- ActivityLog + InsightEngine (suggestions)
   `-- MeshNetwork (adjacency list graph)
            |-- Bfs / Dfs            (who can still reach the gateway)
            |-- PrimMst              (min heap)
            |-- KruskalMst           (union find)
            `-- RouteThroughMst / CheapestRoute
```

The simulator talks to the API in exactly the same way a real device would, so every data structure is exercised through real HTTP requests.

The frontend and the API are separate processes that must both be running. Nothing is stored in a database. All data lives in memory in the API process and is lost when it stops.

---

## Prerequisites

There are two ways to run Smart-X. Either is enough on its own.

**With Docker**, nothing else is needed:

- **Docker Desktop**, or Docker Engine with the Compose plugin

**Without Docker**, install the toolchains directly:

- **.NET 10 SDK**
- **Node.js 18 or newer** and npm (the simulator uses the built in `fetch`)

---

## Setup and running

The quickest way is [Docker](#docker), which starts everything with one command. To run the
toolchains directly instead, open three terminals and follow the steps below.

### 1. Backend API

```powershell
cd SmartX.Api
dotnet restore
dotnet run
```

Wait for `Now listening on: http://localhost:5067` and leave it running.

### 2. Frontend dashboard

```powershell
cd smart-x-dashboard
npm install
npm run dev
```

Wait for `VITE ready`, then open <http://localhost:5173>.

### 3. Device simulator (from the repository root)

```powershell
node simulator/simulate.mjs normal
```

This registers the six Studio HQ sensors and keeps sending readings until you press `Ctrl+C`. Run `node simulator/simulate.mjs help` to see every scenario.

### Console demo (optional)

```powershell
cd SmartX.Core.PROG7312
dotnet run
```

---

## Using the app

1. Open <http://localhost:5173>. The **main menu** shows a live summary (sensors, active alerts, undo stack size, suggestions) and one card per pillar.
2. Use the **menu bar** at the top to move between **Main menu**, **Ingestion**, **Command Stream** and **Topology**. A red badge on Command Stream shows the number of active alerts, and a light on the right shows whether the API is reachable.
3. **Ingestion** (Part 1): register a sensor, send a reading by hand and attach a file to a sensor.
4. **Command Stream** (Part 2): see automated insights, active alerts, the ingestion queues, manual overrides with the undo stack, a live feed (with units), an alert history, a device lookup and a device timeline.
5. **Topology** (Part 3): see the mesh drawn as a graph with every sensor coloured by its health, trace how any node's telemetry reaches the gateway, power a node down and watch the mesh heal, compare the two spanning tree algorithms, and run range queries against the AVL archive. [Reading the map](#reading-the-map) explains what the colours and shapes mean.

### State is kept when you navigate

All three pages stay loaded and the inactive ones are only hidden, so nothing resets when you switch pages:

- Text you have typed but not sent (for example half a device ID in the register form) is still there when you return.
- The data from the API is held in one shared provider above the pages, so a page already has its data when you open it.
- The search box and the chosen timeline device are also saved for the browser tab, so they survive a page refresh.
- Each page remembers how far you had scrolled.
- The menu uses normal links that only change the URL hash (`#/command`), so the back button works and a page can be bookmarked.
- Each pillar is a separate JavaScript bundle, loaded the first time you open it and then kept mounted. Navigation is asynchronous without losing anything you had typed or selected.

---

## How Part 2 works

| Area | Class | Data structure | What it does |
| --- | --- | --- | --- |
| FIFO ingestion | `IngestionQueue` | `Queue<QueuedReading>` | Normal readings wait in arrival order. A lock guards the queue and a `SemaphoreSlim` wakes the worker, so there is no polling loop. |
| Priority lane | `IngestionQueue` | `PriorityQueue<QueuedReading, (int, long)>` | Warning and critical readings are served before anything in the FIFO queue. The key is `(-priority, sequence)`, so the highest priority comes first and equal priorities keep arrival order. |
| Background worker | `TelemetryProcessor` | `BackgroundService` | Takes readings off the queues, stores them, updates alerts and the sensor buffers. |
| Undo | `CommandService` | `Stack<CommandEntry>` | Every command is pushed. Undo pops the newest one and restores the previous state. An empty stack answers `409`. |
| Device lookup | `SensorRegistry` | `Dictionary<string, SensorRegistration>` (case insensitive) | Constant time lookup by device ID, so `ms-hum-01` finds `MS-HUM-01`. |
| Habit counts | `ActivityLog` | `Dictionary<string, Dictionary<string, int>>` | Counts how often each action followed each alert condition. |
| Timelines | `TelemetryHistory` | `SortedDictionary<DateTime, HistoryPoint>` per device | Readings stay in time order, range queries (`from`, `to`) are simple, and only the newest 500 per device are kept. |
| Alert set | `AlertTracker` | `HashSet<string>` | Each alert has a key such as `WS-PWR-01:Critical`. `Add` returns `false` for a key that is already active, so repeated readings never create duplicate alerts. Each refused repeat is counted and shown as **Repeats ignored by the set** in the Alert history panel. |
| Habit dedupe | `ActivityLog` | `HashSet<string>` | An action is counted once per incident, however many times it was clicked. |
| Disconnect detection | `DisconnectMonitor` | `PeriodicTimer` | Every 5 seconds, a device silent for 45 seconds or more gets a `Disconnected` alert. |
| Suggestions | `InsightEngine` | `PriorityQueue<Insight, (int, double)>` | Builds the insight list and ranks it, most urgent first. |

### The suggestion engine

The engine produces four kinds of insight, ranked in this order:

| Rank | Type | When it appears |
| --- | --- | --- |
| 100 / 70 / 60 | **Alert** | A critical reading (100), a silent device (70) or an out of range reading (60). |
| 80 | **Prediction** | A reading is climbing steadily toward its critical limit. A least squares line over the last 8 readings gives the slope. It is shown only when the fit is good (R squared of 0.7 or more) and the limit is less than 15 minutes away. |
| 50 / 45 | **Learned habit** | An alert is active and in the past you fixed the same alert with the same action. Needs at least **3 incidents** and a **60% or better** success share. The suggestion carries a one click Apply button and a plain language reason. |
| 20 | **Frequent search** | You have searched for the same term 3 or more times. |

The Command Stream search box filters the devices shown on the page. Once you stop typing for a second, the term is logged so the engine can notice searches you repeat.

---

## How Part 3 works

Part 3 treats the deployment as what it physically is: a mesh of ESP32 nodes that relay packets for
each other until they reach the gateway. Two problems follow from that, and each one needs a
different structure.

| Area | Class | Data structure | What it does |
| --- | --- | --- | --- |
| Long term history | `TelemetryArchive` | `AvlTree<DateTime, HistoryPoint>` per device | A self balancing search tree keyed by timestamp. Range queries walk down to the start of the range and read across, so the work matches the size of the answer rather than the size of the history. |
| Balance comparison | `UnbalancedBst<TKey>` | Plain binary search tree | Built from the same readings purely to measure what balancing is worth. It is not used to serve any query. |
| Mesh network | `MeshNetwork` | Adjacency list: `Dictionary<string, List<MeshLink>>` | Vertices are nodes, edges are wireless links weighted by the power a packet costs on that hop. |
| Reachability | `MeshNetwork.Bfs` | `Queue<string>` plus a `HashSet<string>` | Breadth first search out from the gateway. Anything it never reaches has been cut off by a failure. |
| Reachability, depth first | `MeshNetwork.Dfs` | `Stack<string>` plus a `HashSet<string>` | Follows one branch to its end before backing up. |
| Spanning tree | `MeshNetwork.PrimMst` | `PriorityQueue<MeshLink, int>`, a binary min heap | Grows one tree out from the gateway, always taking the cheapest link that reaches a new node. |
| Spanning tree, second opinion | `MeshNetwork.KruskalMst` | `DisjointSet` (union find) | Sorts every link by cost and keeps the ones that join two separate parts of the network. |
| Routing | `RouteThroughMst` | Breadth first walk over the spanning tree | A tree holds exactly one path between any two nodes, so this is the route the mesh uses. |
| Routing, best case | `CheapestRoute` | Dijkstra with a min heap | The cheapest route one node could take on its own, used to show what the spanning tree trades away. |
| Hardware addresses | `SensorRegistry` | `Dictionary<string, string>` mapping MAC to device ID | Constant time lookup by hardware address, with no scan of the device list. |

### The mesh

Nine nodes make up the Studio HQ mesh: the gateway `GW-CORE-00`, two repeaters, and the six sensors
from Parts 1 and 2. Any sensor you register on the Ingestion page joins the mesh automatically,
linked to the nearest anchor in its own zone.

Every node carries a hardware address in Espressif's registered block (`24:6F:28:...`), which is the
block real ESP32 chips are issued from. A device that does not bring its own address is given one
derived from its device ID, so it is the same every time the gateway starts.

### Reading the map

The map uses three separate channels so that no colour has to mean two things at once.

**Shape says what a node is for.** A rounded square is the gateway, a diamond is a repeater, and a
circle is a sensor. Gateways and repeaters are drawn in neutral grey, because they carry traffic
rather than take readings. That leaves green, amber and red free to mean one thing only: how a
sensor is doing.

**Colour says how healthy a sensor is.**

| On the map | Meaning |
| --- | --- |
| Green ring | Reporting normally |
| Amber ring | Latest reading is at or above the warning limit |
| Amber dashed ring | Has not reported for 15 seconds |
| Red ring, pulsing | Latest reading is at or above the critical limit |
| Red dashed ring | Has not reported for 45 seconds |
| Dark grey ring | Registered but has never sent a reading |
| Filled centre | An actuator that is switched on |

Each sensor's latest value and unit sit under its name, in the same colour, so the map answers
"how is everything doing" as well as "how is it all wired together".

**Line style says what part a link plays in routing.**

| On the map | Meaning |
| --- | --- |
| Thick orange | The route taken by the node you selected |
| Solid grey | A link the minimum spanning tree keeps |
| Faint dashed | A spare link, available if something fails |
| Red dotted | A link that is down because a node at one end has no power |

The number on each line is that hop's power cost, so the spanning tree total can be checked by hand.

**Trouble in the mesh is drawn as shape, never as colour.** A cross through a node means it has been
powered down. A dashed outline on an otherwise healthy node means it is cut off: it still has power,
but every path back to the gateway runs through something that does not. Keeping these as shapes is
what stops a failed radio from looking like an overheating server rack.

---

### Why two spanning tree algorithms

Prim's and Kruskal's solve the same problem from opposite directions. Running both over the same
graph and comparing the totals is a cheap, strong check that the answer is right: two different
algorithms arriving at the same number by different routes is hard to achieve by accident. The
dashboard shows both totals side by side and says plainly whether they agree.

### Why the spanning tree route can cost more than the cheapest route

The minimum spanning tree minimises the power of the **whole network**. Dijkstra minimises the cost
for **one node**. These are different goals, and the dashboard shows both so the difference is
visible rather than hidden.

With every node online, `MS-DEHUM-01` reaches the gateway for a cost of 9 on its own cheapest path,
but for 12 along the spanning tree. The tree is still the right choice: it keeps 8 links awake
instead of 14, and the total power across the network is lower. Paying 3 more on one node's route is
what buys that.

---

## Data structure explanations

This section explains what each Part 3 structure contributes and why it was chosen, with the code
that does the work.

### 1. AVL tree: historical range queries

**The problem.** The dashboard needs every reading for one device between two timestamps. A list has
to be read from end to end to answer that, and the archive holds thousands of readings per device.

**Why a self balancing tree, not a plain one.** Telemetry arrives in time order, and a key that only
ever increases is the worst case for an unbalanced binary search tree: every new reading goes down
the right hand side, so the tree degrades into a linked list and lookup goes from O(log n) to O(n).
An AVL tree rotates whenever a node tips more than one level out of balance, which keeps the height
at roughly log2(n) no matter what order the keys arrive in.

The app measures this rather than asserting it. `Compare with an unbalanced tree` on the Topology
page builds both trees from the same 2,000 readings:

| Tree | Height | Comparisons to find the newest reading |
| --- | --- | --- |
| AVL, self balancing | 11 | 11 |
| Plain, no balancing | 2,000 | 2,000 |

**The range query.** The saving comes from refusing to walk branches that cannot hold a match:

```csharp
// Walks only the branches that can hold keys inside the range.
private static void CollectRange(Node? node, TKey from, TKey to, List<TValue> results, ref int visited)
{
    if (node is null)
        return;

    visited++;

    var afterFrom = node.Key.CompareTo(from);
    var beforeTo = node.Key.CompareTo(to);

    // Only look left when this node is already past the start of the range.
    if (afterFrom > 0)
        CollectRange(node.Left, from, to, results, ref visited);

    if (afterFrom >= 0 && beforeTo <= 0)
        results.Add(node.Value);

    // Only look right when this node is still before the end of the range.
    if (beforeTo < 0)
        CollectRange(node.Right, from, to, results, ref visited);
}
```

The two comparisons decide whether each side is worth visiting at all. Everything outside the range
is skipped in whole subtrees, so the cost is O(log n + k) for k matches instead of O(n).

**Measured.** On a 8,013 reading archive, a one hour range query visited **250 tree nodes** while a
plain scan of the same readings examined all **8,013**, and both returned the same 240 readings. The
dashboard runs both on every query and shows the two figures next to each other, so the claim is
checked live rather than taken on trust.

**The balancing itself.** A rotation relinks three nodes and fixes two heights, which is constant
work:

```csharp
// Rotates a right heavy node to the left, lifting its right child into its place.
private Node RotateLeft(Node node)
{
    var lifted = node.Right!;
    node.Right = lifted.Left;
    lifted.Left = node;

    Reheight(node);
    Reheight(lifted);
    _rotations++;

    return lifted;
}
```

### 2. Graph: the mesh network

**The problem.** The mesh is nodes joined by wireless links, and the questions asked of it are
reachability and routing. That is a graph.

**Why an adjacency list, not a matrix.** A mesh is sparse. Nine nodes have 14 links, where a matrix
would hold 81 cells, most of them empty. A list stores only the links that exist and lets a
traversal walk one node's neighbours directly, instead of scanning a row of mostly empty cells. The
memory is O(V + E) rather than O(V squared), and that gap widens as the deployment grows.

```csharp
private readonly Dictionary<string, MeshNode> _nodes = new(StringComparer.OrdinalIgnoreCase);
private readonly Dictionary<string, List<MeshLink>> _adjacency = new(StringComparer.OrdinalIgnoreCase);
private readonly List<MeshLink> _edges = new();
private readonly HashSet<string> _offline = new(StringComparer.OrdinalIgnoreCase);
```

A link is stored on both sides, because a wireless hop works in both directions. The `_offline` set
is what makes a failure simulation possible: a node in that set is skipped by every traversal and
every algorithm, without the graph itself being edited.

### 3. Breadth first and depth first search

**Breadth first** clears everything one hop from the gateway before moving further out, so the order
it produces is also the order of fewest hops. That makes it the right walk for "how far is each node
from the gateway".

```csharp
while (queue.Count > 0)
{
    var current = queue.Dequeue();
    order.Add(current);

    foreach (var link in _adjacency[current].OrderBy(l => l.Cost).ThenBy(l => l.To))
    {
        examined++;
        if (!IsUsable(link.To) || !seen.Add(link.To))
            continue;

        queue.Enqueue(link.To);
    }
}
```

`seen.Add` returns false for a node already visited, so the `HashSet` doubles as the cycle guard. A
mesh is full of cycles, and without it the walk would never end.

**Depth first** uses a `Stack` instead of a `Queue` and follows one branch to its end. It answers
"can this node be reached at all" with less bookkeeping.

**What both give the dashboard.** Any node that still has power but was never reached is cut off.
That is the difference between "this node is broken" and "this node is fine but its path home is
broken", and it is the answer the brief asks for when a node goes down.

### 4. Minimum spanning tree: Prim's with a binary min heap

**The problem.** Keeping every radio awake wastes power. The cheapest set of links that still joins
every node to the gateway is a minimum spanning tree.

**Why a heap.** Prim's repeatedly needs the cheapest link reaching a node not yet in the tree.
Scanning the edge list each time is O(E) per step. A binary min heap gives it in O(log E):

```csharp
// The heap is keyed by cost, so Dequeue always returns the cheapest link still on offer.
var frontier = new PriorityQueue<MeshLink, int>();

inTree.Add(GatewayId);

foreach (var link in _adjacency[GatewayId])
{
    if (IsUsable(link.To))
    {
        frontier.Enqueue(link, link.Cost);
        operations++;
    }
}

while (frontier.Count > 0)
{
    var cheapest = frontier.Dequeue();
    operations++;

    // Both ends already in the tree means this link would close a cycle.
    if (!inTree.Add(cheapest.To))
        continue;

    chosen.Add(cheapest);

    foreach (var next in _adjacency[cheapest.To])
    {
        if (IsUsable(next.To) && !inTree.Contains(next.To))
        {
            frontier.Enqueue(next, next.Cost);
            operations++;
        }
    }
}
```

The `inTree` set is doing two jobs: it records membership and it rejects cycles, both in constant
time. The heap operation count is reported to the dashboard, so the structure's use is visible.

### 5. Minimum spanning tree: Kruskal's with union find

Kruskal's sorts every link by cost and keeps each one that joins two parts of the network not
already connected. The question "already connected?" is what union find answers:

```csharp
foreach (var edge in usable)
{
    operations++;

    // Union returns false when both ends share a set already, which would make a cycle.
    if (sets.Union(edge.From, edge.To))
        chosen.Add(edge);
}
```

Inside `DisjointSet`, two optimisations keep that near constant time. **Path compression** points
every node on the way at the root, so the next lookup is immediate:

```csharp
// Path compression: point everything on the way at the root, so the next Find is immediate.
var walk = id;
while (!string.Equals(_parent[walk], root, StringComparison.OrdinalIgnoreCase))
{
    var next = _parent[walk];
    _parent[walk] = root;
    walk = next;
}
```

**Union by rank** hangs the shallower tree off the deeper one, so depth grows slowly:

```csharp
// Union by rank: hang the shallower tree off the deeper one so the depth grows slowly.
if (_rank[a] < _rank[b])
    (a, b) = (b, a);

_parent[b] = a;

if (_rank[a] == _rank[b])
    _rank[a]++;
```

**Why both algorithms.** They approach the problem from opposite ends, so agreement is meaningful.
On the Studio HQ mesh both return 8 links at a total cost of 25, and the dashboard states that
agreement in words.

### 6. What this buys the Network Topology feature

| Question the dashboard answers | Structure | Cost |
| --- | --- | --- |
| Every reading between two times for one device | AVL tree | O(log n + k) instead of O(n) |
| Which nodes can still reach the gateway | BFS or DFS over an adjacency list | O(V + E) |
| Which links should stay awake | Prim with a min heap | O(E log V) |
| Is that answer right | Kruskal with union find | O(E log E), cross checked |
| How does this node's telemetry get home | BFS over the spanning tree | O(V) |
| Find a node by its hardware address | MAC dictionary | O(1) |

---

## Testing guide

Start the API and the dashboard first (see [Setup and running](#setup-and-running)). The commands below use PowerShell. Run the simulator commands from the repository root. Anywhere you see `Invoke-RestMethod`, a browser or any HTTP client works too.

Run `node simulator/simulate.mjs recover` once so all six sensors are registered.

### Test 1: FIFO queue (normal readings)

1. Run `node simulator/simulate.mjs normal` and leave it going.
2. Run:

   ```powershell
   Invoke-RestMethod http://localhost:5067/queues/status
   ```

3. Run it again after a few seconds.

**Expected:** `totalEnqueued` and `totalProcessed` keep rising together and `fifoDepth` stays at or near `0`. On the dashboard, the **Ingestion queues** panel shows the same numbers and the **Live feed** lists readings newest first.

### Test 2: Priority queue (simulate a high priority alert)

**Option A, one command.** Send a single critical power reading:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5067/telemetry -ContentType "application/json" -Body '{"deviceId":"WS-PWR-01","value":4200}'
Invoke-RestMethod http://localhost:5067/alerts/active
```

You can do the same from the dashboard: **Ingestion**, find **WS-PWR-01**, type `4200` and click **Send reading**.

**Expected:** the reply is `202 Accepted` with `"severity": "Critical"`. `alerts/active` lists `WS-PWR-01:Critical`, the **Command Stream** menu item gets a red badge, and an **Alert** insight appears at the top of the feed. Send a normal value (for example `900`) and the alert clears.

**Option B, prove it jumps the queue.**

```powershell
node simulator/simulate.mjs burst
```

The script slows the worker down, floods the FIFO queue with 200 normal readings, then sends one critical reading.

**Expected output** (the exact numbers vary):

```text
  Queued. Waiting in the FIFO queue right now: 191
  Sent one critical reading (WS-PWR-01 = 4200).
  Done. The critical reading was served with 191 normal readings still waiting.
```

Confirm it afterwards:

```powershell
Invoke-RestMethod http://localhost:5067/queues/status
```

`lastCriticalBypassedBacklog` is greater than `0`. That is the number of normal readings that were still waiting in the FIFO queue when the critical reading was served. The dashboard shows the same sentence in the **Ingestion queues** panel.

**Option C, a whole incident.** `node simulator/simulate.mjs power-spike` sends three critical readings and then returns to normal.

### Test 3: Stack and undo

1. Open **Command Stream**, then **Manual override**.
2. Click **Turn on** for `MS-DEHUM-01`, then **Turn on** for `ITC-CRAC-01`.
3. Look at **Undo stack**: the newest command is on top and tagged **next undo**.
4. Click **Undo last command**.

**Expected:** `ITC-CRAC-01` returns to `OFF` and leaves the stack. A second undo reverses `MS-DEHUM-01`. With nothing left, the button is disabled. Through the API, an undo on an empty stack returns `409` with the message `There are no commands to undo.`:

```powershell
Invoke-RestMethod -Method Post http://localhost:5067/commands/undo
Invoke-RestMethod http://localhost:5067/commands/history
```

### Test 4: Dictionaries and sorted history

**Case insensitive dictionary.** The lowercase ID still finds the sensor:

```powershell
Invoke-RestMethod http://localhost:5067/sensors/ms-hum-01
```

**Sorted dictionary.** The timeline is returned oldest to newest and can be cut by time:

```powershell
Invoke-RestMethod "http://localhost:5067/telemetry/history/MS-HUM-01?limit=10"

$from = (Get-Date).ToUniversalTime().AddMinutes(-1).ToString("o")
Invoke-RestMethod "http://localhost:5067/telemetry/history/MS-HUM-01?from=$from"
```

**On the dashboard.** On the Command Stream page, find the **Device lookup** panel and type `ms-hum-01` in lowercase. The panel shows **Registry found: MS-HUM-01** (the dictionary ignores letter case), how many readings are stored (**of 500 kept**) and the oldest and newest reading times (the sorted dictionary). Type a name that does not exist, such as `nope-99`, and it says no device is registered with that ID.

Then open **Device timeline** and choose a device. Warning and critical readings show as amber and red dots.

**Cap.** Only the newest 500 readings per device are kept. Run `node simulator/simulate.mjs burst` nine times, then check that `count` is `500`:

```powershell
(Invoke-RestMethod "http://localhost:5067/telemetry/history/MS-HUM-01?limit=500").count
```

### Test 5: Sets (no duplicate alerts)

1. Run `node simulator/simulate.mjs power-spike`. It sends three critical readings in a row.
2. On the Command Stream page, look at the **Alert history** panel.
3. Or run:

   ```powershell
   Invoke-RestMethod "http://localhost:5067/alerts/events?limit=10"
   ```

**Expected:** **Alerts raised** goes up by exactly one and **Repeats ignored by the set** goes up by two, because the second and third critical readings were refused by the `HashSet`. The log shows one `Raised` entry for `WS-PWR-01:Critical` (not three), followed by one `Recovered` entry when the readings return to normal. Run the scenario again and **Alerts raised** goes up by exactly one more, because the set was cleared when the alert recovered. In the API response the same numbers are `raisedTotal` and `duplicatesIgnored`.

For the disconnect alert, run `node simulator/simulate.mjs dropout` (it takes about a minute and a half). `ITC-TEMP-01` goes silent, one `Disconnected` alert is raised after 45 seconds even though the monitor checks every 5 seconds, and it clears when readings resume.

### Test 6: Predictive suggestions

**Learned habit (with demo history).**

1. Run `node simulator/simulate.mjs seed-history`, or click **Load demo history** on the Command Stream page. This adds a believable operator history.
2. Run `node simulator/simulate.mjs humidity-high`. Humidity in Material Storage climbs.
3. When the humidity alert becomes critical, the insight feed shows **Turn MS-DEHUM-01 on** with its confidence and the reason it was suggested.
4. Click **Apply**. The dehumidifier switches on, the simulator brings the humidity back down and the alert clears.

**Prediction.** Run `node simulator/simulate.mjs server-hot`. Before the rack temperature reaches its limit, a **Prediction** insight says how fast `ITC-TEMP-01` is rising and roughly how many seconds remain until 35 degrees C. With the demo history loaded, a learned suggestion to turn `ITC-CRAC-01` on appears once it goes critical, along with **Search for "crac"**.

**Learning for real (no demo history).** Restart the API so the history is empty. Then repeat this three times: raise a critical humidity reading, click **Turn on** for `MS-DEHUM-01`, and let it clear.

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5067/telemetry -ContentType "application/json" -Body '{"deviceId":"MS-HUM-01","value":75}'
Invoke-RestMethod -Method Post -Uri http://localhost:5067/commands -ContentType "application/json" -Body '{"deviceId":"MS-DEHUM-01","on":true}'
Invoke-RestMethod -Method Post -Uri http://localhost:5067/telemetry -ContentType "application/json" -Body '{"deviceId":"MS-HUM-01","value":45}'
Invoke-RestMethod -Method Post -Uri http://localhost:5067/commands -ContentType "application/json" -Body '{"deviceId":"MS-DEHUM-01","on":false}'
```

On the fourth critical humidity reading, `Invoke-RestMethod http://localhost:5067/insights` contains a habit suggestion to turn `MS-DEHUM-01` on with a confidence of `0.75`. Before the third repeat there is no suggestion, because a habit needs at least 3 incidents.

### Test 7: Navigation and kept state

1. On **Ingestion**, type `TEST-1` into the **Device ID** box without registering it.
2. Go to **Command Stream**, type `crac` into the search box and scroll down a little.
3. Go to **Main menu**, then back to **Ingestion**, then back to **Command Stream**.

**Expected:** `TEST-1` is still in the box, `crac` is still in the search box, the page is at the same scroll position and the data did not reload from empty. Refreshing the browser keeps the search term.


### Test 8: Trees, range queries over a long history

1. Open **Topology** and scroll to **Historical log and range query**.
2. Click **Load a long history**. This back dates about 4,000 readings per device, so the tree has
   something worth searching.
3. Pick a device, click **Last hour**, then **Run range query**.

**Expected:** under **The tree behind this device**, the tree reports its size, its height, the
number of rotations it performed and that it is still balanced. The height stays close to the ideal
even with thousands of readings, for example 13 levels for 8,013 readings.

Under **What that query cost**, the same range is answered twice: once down the tree and once by
scanning an unsorted list of identical readings. Both return the same number of readings, but the
tree visits far fewer entries, typically 30 times less work. **Both answers match** reads `Yes`.

The same query from PowerShell:

```powershell
$to = (Get-Date).ToUniversalTime().ToString("o")
$from = (Get-Date).ToUniversalTime().AddHours(-1).ToString("o")
(Invoke-RestMethod "http://localhost:5067/archive/ITC-TEMP-01/range?from=$from&to=$to").report
```

### Test 9: Why the tree balances itself

1. In the same panel, click **Compare with an unbalanced tree**.

**Expected:** the same 2,000 readings are built into an AVL tree and into a plain binary search tree
with no balancing. The AVL tree is about 11 levels deep. The plain tree is 2,000 levels deep,
because timestamps only ever increase and every reading lands to the right of the one before it.
Finding the newest reading costs 11 comparisons in one and 2,000 in the other.

```powershell
Invoke-RestMethod "http://localhost:5067/archive/ITC-TEMP-01/balance-proof?sample=2000"
```

### Test 10: Graph traversal and minimum spanning trees

1. On **Topology**, look at **Minimum spanning tree**.

**Expected:** Prim's (binary min heap) and Kruskal's (union find) both report the same total cost
over the same number of links, and the panel says so in words. The heap operation count shows the
min heap being used. **Links kept** lists the chosen links, which are also drawn in colour on the
map while the spare links stay dashed.

2. Look at **Who can reach the gateway**. With every node online, **Cut off** is `0` and the visit
   order starts at `GW-CORE-00`.
3. Click **Depth first** and then **Breadth first**. The visit order changes but the set of reached
   nodes does not.

```powershell
Invoke-RestMethod "http://localhost:5067/mesh" | Select-Object -ExpandProperty prim
Invoke-RestMethod "http://localhost:5067/mesh/traversal?start=GW-CORE-00&algorithm=dfs"
```

### Test 11: Routing by MAC address, and a node failure

1. In **Routing path**, type `24:6F:28:C3:6D:02`. It resolves to `MS-DEHUM-01`, which is the MAC
   address lookup.
2. Note the two routes. The spanning tree route costs 12, the node's own cheapest route costs 9, and
   the panel explains why the tree can be dearer for one node.
3. Type `RPT-HALL-01` and click **Simulate a power failure**.
4. Type `MS-DEHUM-01` again.

**Expected:** the node is drawn as powered down on the map, and `MS-DEHUM-01` now routes a different
way, through `WS-PWR-01` and `RPT-MEZZ-02`, at a cost of 18 instead of 9. The mesh healed, and the
higher number is the power that healing costs.

5. Also power down `RPT-MEZZ-02`.

**Expected:** **Cut off** rises and the nodes with no path home are listed by name, separately from
the nodes that have simply lost power. Their routing panel says they are cut off rather than broken.

6. Click **Restore the whole mesh** to bring everything back.

The gateway cannot be powered down, because everything routes to it:

```powershell
Invoke-RestMethod -Method Post "http://localhost:5067/mesh/nodes/GW-CORE-00/power?on=false"
```

This returns `422` with an explanation.

### Test 12: All three pillars, and asynchronous navigation

1. Open the **main menu**. All three cards are active and the summary strip includes **Mesh nodes
   online**.
2. Open the browser's network panel, then click **Topology** for the first time in that tab.

**Expected:** the topology bundle is fetched at that moment, not when the page first loaded. Each
pillar is a separate chunk, so the menu appears without waiting for code nobody has opened yet.

3. Type a node into **Routing path**, go to **Command Stream**, then come back.

**Expected:** the typed node is still there, with its route still displayed. The page was loaded once
and then kept, so asynchronous loading never costs you your state. Refreshing the browser keeps it too.

---

## API reference

### Part 1

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/sensors` | List every registered sensor with its latest value |
| `POST` | `/sensors` | Register a sensor: `{ deviceId, zone, category, valueType, macAddress? }` |
| `GET` | `/sensors/{id}` | Look up one sensor (case insensitive) |
| `POST` | `/sensors/{id}/media` | Upload a file for a sensor (`multipart/form-data`, field name `file`, 10 MB limit) |
| `GET` | `/telemetry/flushed` | Readings that completed a batch and flushed from the jagged array buffer into a `List<T>` |

### Part 2

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/telemetry` | Ingest one reading: `{ deviceId, value }`. Replies `202` and queues it. |
| `GET` | `/telemetry/history/{deviceId}?from&to&limit` | One device's sorted timeline (limit 1 to 500) |
| `GET` | `/telemetry/recent?limit` | The newest readings from every device |
| `GET` | `/queues/status` | Queue depths, totals and how many readings the last critical reading jumped |
| `POST` | `/queues/delay/{ms}` | Slow the worker by 0 to 500 ms per reading (used by the `burst` demo) |
| `POST` | `/commands` | Switch an actuator: `{ deviceId, on, source? }`. `404` unknown device, `422` not an on/off actuator. |
| `POST` | `/commands/undo` | Undo the newest command. `409` if the stack is empty. |
| `GET` | `/commands/history` | The undo stack, newest first |
| `GET` | `/alerts/active` | The current alert set |
| `GET` | `/alerts/events?limit` | The alert log (raised and recovered), `raisedTotal` and `duplicatesIgnored` |
| `GET` | `/insights` | Ranked alerts, predictions and learned suggestions |
| `POST` | `/activity/search` | Log a settled search term: `{ term }` |
| `GET` | `/activity?limit` | The newest logged searches and commands |
| `POST` | `/demo/seed-history` | Add demo operator history (`409` if already added) |


### Part 3

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/sensors/by-mac/{mac}` | Look a sensor up by hardware address through the MAC index |
| `GET` | `/mesh` | Every node and link, plus both spanning trees and whether they agree |
| `GET` | `/mesh/traversal?start&algorithm` | Breadth or depth first walk; `algorithm` is `bfs` or `dfs` |
| `GET` | `/mesh/route/{idOrMac}` | The spanning tree route and the cheapest route to the gateway |
| `POST` | `/mesh/nodes/{id}/power?on` | Power a node down or up. `422` for the gateway |
| `POST` | `/mesh/reset` | Bring every powered down node back online |
| `GET` | `/archive/{deviceId}?limit` | The newest archived readings, with the state of the AVL tree |
| `GET` | `/archive/{deviceId}/range?from&to` | A range query, with the tree walk measured against a plain scan |
| `GET` | `/archive/{deviceId}/balance-proof?sample` | The same readings in a balanced and an unbalanced tree |
| `GET` | `/archive` | How much history is held, per device and in total |
| `POST` | `/demo/backfill?readings` | Back date readings so the tree can be shown over a long history |

### Valid values

- **Zone:** `Showroom Floor`, `Material Storage`, `Workshop`, `IT Closet` (validated recursively against the `Studio HQ` deployment tree)
- **Category:** `Environmental`, `Power`, `Actuator`
- **Value type:** `Float`, `Int`, `Bool`
- **Device ID:** letters, numbers, dashes, underscores, dots and colons, up to 64 characters
- **MAC address:** six pairs of hex digits separated by colons, for example `24:6F:28:A1:4B:01`. A device that does not supply one is given a stable address derived from its device ID.

---

## Thresholds

A reading at or above the warning limit is **Warning**. At or above the critical limit it is **Critical**. Critical readings use the priority queue and priority grows with how far past the limit the value is. A zone specific rule wins over a general category rule.

| Zone | Category | Unit | Warning | Critical |
| --- | --- | --- | --- | --- |
| IT Closet | Environmental | degrees C | 30 | 35 |
| Material Storage | Environmental | % | 60 | 70 |
| Any | Power | W | 2500 | 3500 |

A device that has been silent for 15 seconds shows as slow to report. After 45 seconds it is disconnected.

---

## Simulator scenarios

Run with `node simulator/simulate.mjs <scenario>` from the repository root. Settings are environment variables: `API` (default `http://localhost:5067`), `CYCLE_MS` (default `2000`) and `DROP_SECONDS` (default `75`).

| Scenario | What it does | What it shows |
| --- | --- | --- |
| `normal` | Steady readings from every sensor until `Ctrl+C` | FIFO queue, live feed, timelines |
| `power-spike` | Workshop power jumps past the critical limit, then recovers | Priority queue, one alert per incident |
| `humidity-high` | Material Storage humidity climbs until critical | Alerts, learned habit suggestion |
| `server-hot` | Server rack temperature climbs steadily | Trend prediction, then critical |
| `dropout` | `ITC-TEMP-01` goes silent for 75 seconds | One disconnect alert, then recovery |
| `recover` | One normal reading from every sensor | Clears alerts, registers sensors |
| `burst` | 200 queued readings, then one critical reading | The critical reading jumps the queue |
| `seed-history` | Adds demo operator history | Suggestions straight away |

---

## Security notes

- Device IDs are checked against a strict pattern, which also rejects `.` and `..`, so an ID can never be used to walk out of the uploads folder.
- Upload folder names are rebuilt from safe characters only, file names go through `Path.GetFileName`, and uploads are capped at 10 MB.
- Reading values are checked against the sensor's registered type (`Float`, `Int` or `Bool`) before they are queued, and unknown devices are rejected with `404`.
- Command targets must be registered on/off actuators.
- CORS only allows the dashboard origin (`http://localhost:5173`).
- Hardware addresses are validated against a strict pattern and normalised, and a MAC already in use by another device is rejected with `409`.
- The gateway cannot be powered down through the API, so the topology can never be left with nothing to route to.

---

## Docker

The whole stack runs with one command. From the repository root:

```powershell
docker compose up --build
```

Then open <http://localhost:5173>. The first build takes a few minutes while the base images are
pulled; after that it starts in seconds. Press `Ctrl+C` to stop, or:

```powershell
docker compose down
```

### What it starts

| Service | Image | Port on your machine | What it does |
| --- | --- | --- | --- |
| `api` | Built from `SmartX.Api/Dockerfile` | `5067` | The ASP.NET Core API |
| `dashboard` | Built from `smart-x-dashboard/Dockerfile` | `5173` | The built React app, served by nginx |
| `simulator` | `node:22-alpine` | none | Sends telemetry to the API, standing in for the ESP32 hardware |

The ports are the same ones used when running without Docker, so every address in this README works
either way, including the PowerShell commands in the testing guide.

### How it is put together

Both images are **multi stage builds**. The API is compiled with the .NET SDK image and then copied
onto the much smaller ASP.NET runtime image, so the SDK and the source never ship. The dashboard is
compiled with Node and then copied onto nginx, so Node never ships either. In both cases what runs
is only the built application.

**nginx serves the dashboard and proxies the API.** The dashboard calls `/api/...`, and nginx
forwards those to the `api` container, stripping the prefix exactly as the Vite dev proxy does. The
browser only ever talks to one origin, so no CORS headers are involved.

**The simulator waits for the API** before it starts sending, rather than failing on its first
request and leaving the dashboard empty.

**Uploaded media is kept in a named volume**, so files attached to a sensor survive a rebuild.

### Running a scenario

The simulator runs the `normal` scenario by default. To run one of the others against the same
stack, leave it running and start a second simulator alongside it:

```powershell
docker compose run --rm simulator node simulate.mjs power-spike
```

Replace `power-spike` with any scenario from the [simulator scenarios](#simulator-scenarios) table.
For tests that need the normal stream stopped first, such as the alert tests, stop it with:

```powershell
docker compose stop simulator
```

### Rebuilding after a code change

```powershell
docker compose up --build
```

Docker caches each step, so a change to the C# or the React code does not repeat the dependency
restore. Only a change to `SmartX.Api.csproj` or `package.json` does.

---

## Written submissions

| Document | File | What it covers |
| --- | --- | --- |
| Project completion report | `docs/Smart-X-Project-Report.pdf` | What was built across all three parts, the architectural and algorithmic challenges and how they were overcome, key learnings, and technology recommendations with their rationale |
| Feedback incorporation ledger | `docs/Feedback-Incorporation-Ledger.pdf` | Every update made in response to marker feedback on Parts 1 and 2, with the cause, the change and where to find it |

The Markdown source of each is kept beside the PDF in `docs/`.

---

## Tech stack

- **Backend:** C# on .NET 10, ASP.NET Core Minimal API, `BackgroundService` workers. The AVL tree, union find and comparison BST are written from scratch in `SmartX.Api/Structures/`.
- **Frontend:** React 18, TypeScript, Vite, plain CSS (no UI framework). Each pillar is code split and loaded on first use.
- **Simulator:** Node.js 18 or newer (no dependencies)
- **Data storage:** in memory only. There is no database.

---

## AI Declaration

**Please Note:** In this project AI was used to help provide an understanding of how to implement certain features. It was used to help debug syntax and logical errors when stuck on solving a code issue. It was also used to help understand error codes and routing issues between the api and the application. Please be advised that the AI I used to assist me was Claude, model: Sonnet 5.5.

For Part 3 the same assistance continued, using Claude Sonnet 5.5 and Claude Opus 5.

---

ST10440190
Christopher Graham
Emeris College Newlands
