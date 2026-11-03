# Smart-X Sensor Data Ingestion and Telemetry Gateway

Smart-X is a hybrid IoT gateway for **Studio HQ**, an interior design and architecture studio. It monitors the building systems behind the studio: environmental conditions, power draw and automated actuators across four zones: **Showroom Floor**, **Material Storage**, **Workshop** and **IT Closet**.

- **Part 1** is the ingestion pipeline and the dashboard for registering sensors and watching their status live.
- **Part 2** adds the **Real-Time Command Stream and History** pillar: queued ingestion, a priority lane for critical readings, manual overrides with undo, live alerts, sorted device timelines and a suggestion engine that learns from how the operator works.

> Demo video: ADD  YOUTUBE LINK HERE BEFORE SUBMITTING

## Contents

1. [Repository structure](#repository-structure)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup and running](#setup-and-running)
5. [Using the app](#using-the-app)
6. [How Part 2 works](#how-part-2-works)
7. [Testing guide](#testing-guide)
8. [API reference](#api-reference)
9. [Thresholds](#thresholds)
10. [Simulator scenarios](#simulator-scenarios)
11. [Security notes](#security-notes)
12. [Docker](#docker)
13. [Tech stack](#tech-stack)

---

## Repository structure

| Folder | Purpose |
| --- | --- |
| `SmartX.Core.PROG7312/` | A standalone console app that proves the core C# requirements in isolation: generics (`TelemetryPacket<T>`), operator overloading (`SensorReading`), recursion (`DeviceNode`) and jagged arrays feeding a `List<T>` (`TelemetryBuffer<T>`). It is a scaffolding step and not part of the submitted application. |
| `SmartX.Api/` | The backend: an ASP.NET Core Minimal API with the queues, stack, dictionaries, sets and the suggestion engine. |
| `smart-x-dashboard/` | The frontend: a React and TypeScript single page app. |
| `simulator/` | A Node script that behaves like physical devices and sends plain HTTP requests to the API. |

Inside `SmartX.Api/`:

| Folder | Contents |
| --- | --- |
| `Models/` | Records and enums (`QueuedReading`, `CommandEntry`, `ActiveAlert`, `Insight` and so on). |
| `Services/` | The logic: `IngestionQueue`, `TelemetryProcessor`, `DisconnectMonitor`, `CommandService`, `TelemetryHistory`, `AlertTracker`, `ActivityLog`, `InsightEngine`, `ThresholdPolicy`, `SensorRegistry`. |
| `Endpoints/` | The Part 2 routes, one class per area (`TelemetryEndpoints`, `CommandEndpoints`, `AlertEndpoints`, `InsightEndpoints`). |

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
   |-- DisconnectMonitor (background worker, checks for silent devices)
   |-- CommandService (Stack<T> for undo)
   `-- ActivityLog + InsightEngine (suggestions)
```

The simulator talks to the API in exactly the same way a real device would, so every data structure is exercised through real HTTP requests.

The frontend and the API are separate processes that must both be running. Nothing is stored in a database. All data lives in memory in the API process and is lost when it stops.

---

## Prerequisites

- **.NET 10 SDK**
- **Node.js 18 or newer** and npm (the simulator uses the built in `fetch`)

---

## Setup and running

Open three terminals.

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
2. Use the **menu bar** at the top to move between **Main menu**, **Ingestion** and **Command Stream**. A red badge on Command Stream shows the number of active alerts, and a light on the right shows whether the API is reachable.
3. **Ingestion** (Part 1): register a sensor, send a reading by hand and attach a file to a sensor.
4. **Command Stream** (Part 2): see automated insights, active alerts, the ingestion queues, manual overrides with the undo stack, a live feed and a device timeline.

### State is kept when you navigate

All three pages stay loaded and the inactive ones are only hidden, so nothing resets when you switch pages:

- Text you have typed but not sent (for example half a device ID in the register form) is still there when you return.
- The data from the API is held in one shared provider above the pages, so a page already has its data when you open it.
- The search box and the chosen timeline device are also saved for the browser tab, so they survive a page refresh.
- Each page remembers how far you had scrolled.
- The menu uses normal links that only change the URL hash (`#/command`), so the back button works and a page can be bookmarked.

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
| Alert set | `AlertTracker` | `HashSet<string>` | Each alert has a key such as `WS-PWR-01:Critical`. `Add` returns `false` for a key that is already active, so repeated readings never create duplicate alerts. |
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

On the dashboard, open **Device timeline** and choose a device. Warning and critical readings show as amber and red dots.

**Cap.** Only the newest 500 readings per device are kept. Run `node simulator/simulate.mjs burst` nine times, then check that `count` is `500`:

```powershell
(Invoke-RestMethod "http://localhost:5067/telemetry/history/MS-HUM-01?limit=500").count
```

### Test 5: Sets (no duplicate alerts)

1. Run `node simulator/simulate.mjs power-spike`. It sends three critical readings in a row.
2. Run:

   ```powershell
   Invoke-RestMethod "http://localhost:5067/alerts/events?limit=10"
   ```

**Expected:** exactly one `Raised` entry for `WS-PWR-01:Critical` (not three), followed by one `Recovered` entry when the readings return to normal. Run the scenario again and `raisedTotal` goes up by exactly one, because the set was cleared when the alert recovered.

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

---

## API reference

### Part 1

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/sensors` | List every registered sensor with its latest value |
| `POST` | `/sensors` | Register a sensor: `{ deviceId, zone, category, valueType }` |
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
| `GET` | `/alerts/events?limit` | The alert log (raised and recovered) |
| `GET` | `/insights` | Ranked alerts, predictions and learned suggestions |
| `POST` | `/activity/search` | Log a settled search term: `{ term }` |
| `GET` | `/activity?limit` | The newest logged searches and commands |
| `POST` | `/demo/seed-history` | Add demo operator history (`409` if already added) |

### Valid values

- **Zone:** `Showroom Floor`, `Material Storage`, `Workshop`, `IT Closet` (validated recursively against the `Studio HQ` deployment tree)
- **Category:** `Environmental`, `Power`, `Actuator`
- **Value type:** `Float`, `Int`, `Bool`
- **Device ID:** letters, numbers, dashes, underscores, dots and colons, up to 64 characters

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

---

## Docker

Docker is not used. The API and the dashboard run directly with `dotnet run` and `npm run dev` as described above.

---

## Tech stack

- **Backend:** C# on .NET 10, ASP.NET Core Minimal API, `BackgroundService` workers
- **Frontend:** React 18, TypeScript, Vite, plain CSS (no UI framework)
- **Simulator:** Node.js 18 or newer (no dependencies)
- **Data storage:** in memory only. There is no database.


## AI Declaration

**Please Note:** In this project AI was used to help provide an understanding of how to implement certain features. It was used to help debug syntax and logical errors when stuck on solving a code issue. It was also used to help understand error codes and routing issues between the api and the application. Please be advised that the AI I used to assist me was Claude, model: Sonnet 5.5. 


ST10440190
Christopher Graham
Emeris College Newlands


