// Smart-X device simulator.
// It sends plain HTTP requests to the API, exactly like a real ESP32 or smart plug would,
// so every queue, dictionary, set and suggestion in the API is exercised the real way.
//
// Usage (Node 18 or newer, with the API running):
//   node simulator/simulate.mjs <scenario>
//
// Scenarios: normal, power-spike, humidity-high, server-hot, dropout, recover, burst, seed-history
// Settings:  API (default http://localhost:5067), CYCLE_MS (default 2000), DROP_SECONDS (default 75)

const API = process.env.API ?? "http://localhost:5067";
const CYCLE_MS = Number(process.env.CYCLE_MS ?? 2000);
const DROP_SECONDS = Number(process.env.DROP_SECONDS ?? 75);

// The Studio HQ sensors. Floats have a normal level and a small random spread.
const SENSORS = [
  { deviceId: "SR-LUX-01", zone: "Showroom Floor", category: "Environmental", valueType: "Float", base: 340, spread: 12 },
  { deviceId: "MS-HUM-01", zone: "Material Storage", category: "Environmental", valueType: "Float", base: 45, spread: 1.5 },
  { deviceId: "WS-PWR-01", zone: "Workshop", category: "Power", valueType: "Float", base: 900, spread: 60 },
  { deviceId: "ITC-TEMP-01", zone: "IT Closet", category: "Environmental", valueType: "Float", base: 24, spread: 0.3 },
  { deviceId: "MS-DEHUM-01", zone: "Material Storage", category: "Actuator", valueType: "Bool" },
  { deviceId: "ITC-CRAC-01", zone: "IT Closet", category: "Actuator", valueType: "Bool" }
];

// Waits for a number of milliseconds.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
//-----------//

// Calls the API and returns the status and the parsed body (JSON, or plain text if it is not JSON).
async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Plain-text error messages stay as text.
  }
  return { status: res.status, data };
}
//-----------//

// A value near the base level, rounded to one decimal place.
function jitter(base, spread) {
  return Math.round((base + (Math.random() * 2 - 1) * spread) * 10) / 10;
}
//-----------//

// Registers every sensor. A 409 means it was already registered, which is fine.
async function registerAll() {
  for (const s of SENSORS) {
    const { status, data } = await call("POST", "/sensors", {
      deviceId: s.deviceId,
      zone: s.zone,
      category: s.category,
      valueType: s.valueType
    });
    if (status !== 201 && status !== 409) {
      console.error(`Could not register ${s.deviceId}: ${status} ${JSON.stringify(data)}`);
      process.exit(1);
    }
  }
  console.log(`Registered ${SENSORS.length} sensors (existing ones were left alone).`);
}
//-----------//

// Reads the current state of the on/off actuators from the API, so the simulator echoes commands back like a real device.
async function readActuators() {
  const { data } = await call("GET", "/sensors");
  const states = {};
  for (const s of data) {
    if (s.category === "Actuator") states[s.deviceId] = s.lastValue === true;
  }
  return states;
}
//-----------//

// Sends one reading. Returns true if the API accepted it.
async function send(deviceId, value) {
  const { status, data } = await call("POST", "/telemetry", { deviceId, value });
  if (status !== 202) {
    console.error(`  ${deviceId} rejected: ${status} ${JSON.stringify(data)}`);
    return false;
  }
  return true;
}
//-----------//

// Reads one actuator's current state, right before it reports, so a command that just landed is never overwritten by a stale echo.
async function readActuator(deviceId) {
  const { status, data } = await call("GET", `/sensors/${encodeURIComponent(deviceId)}`);
  return status === 200 && data.lastValue === true;
}
//-----------//

// Sends one reading from every sensor. Overrides give a fixed value, or "skip" to stay silent.
async function cycle(overrides = {}) {
  const sent = [];

  for (const s of SENSORS) {
    const override = overrides[s.deviceId];
    if (override === "skip") continue;

    const value =
      s.valueType === "Bool" ? await readActuator(s.deviceId) : override !== undefined ? override : jitter(s.base, s.spread);

    if (await send(s.deviceId, value)) sent.push(`${s.deviceId}=${value}`);
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${sent.join("  ")}`);
}
//-----------//

// Sends several normal cycles in a row.
async function normalCycles(count) {
  for (let i = 0; i < count; i++) {
    await cycle();
    await sleep(CYCLE_MS);
  }
}
//-----------//

// Keeps sending normal readings until you press Ctrl+C.
async function normal() {
  console.log("Sending normal readings. Press Ctrl+C to stop.");
  for (;;) {
    await cycle();
    await sleep(CYCLE_MS);
  }
}
//-----------//

// Workshop power jumps well past the critical limit for three cycles, then returns to normal.
async function powerSpike() {
  console.log("Scenario: power spike on WS-PWR-01.");
  await normalCycles(3);
  for (let i = 0; i < 3; i++) {
    await cycle({ "WS-PWR-01": jitter(4200, 100) });
    await sleep(CYCLE_MS);
  }
  await normalCycles(3);
}
//-----------//

// One reading drifts upward until it is critical. Switching its actuator on (from the dashboard) pulls it back down.
async function drift({ deviceId, actuatorId, start, step, max, relief, maxCycles, label }) {
  console.log(`Scenario: ${label}. Turn ${actuatorId} on from the Command Stream page to bring it back down.`);
  await normalCycles(2);

  let value = start;
  for (let i = 0; i < maxCycles; i++) {
    const actuators = await readActuators();
    const on = actuators[actuatorId] === true;

    value = Math.min(max, value + step);
    if (on) value = Math.max(start, value - step - relief);

    await cycle({ [deviceId]: Math.round(value * 10) / 10 });
    await sleep(CYCLE_MS);

    if (on && value <= start + 1) break;
  }

  await normalCycles(3);
}
//-----------//

// Material Storage humidity climbs past the warning and critical limits.
async function humidityHigh() {
  await drift({
    deviceId: "MS-HUM-01",
    actuatorId: "MS-DEHUM-01",
    start: 45,
    step: 4,
    max: 78,
    relief: 3,
    maxCycles: 30,
    label: "humidity rising in Material Storage"
  });
}
//-----------//

// The server rack temperature climbs steadily, which gives the trend detector something to predict.
async function serverHot() {
  await drift({
    deviceId: "ITC-TEMP-01",
    actuatorId: "ITC-CRAC-01",
    start: 24,
    step: 0.4,
    max: 40,
    relief: 1.2,
    maxCycles: 45,
    label: "server rack heating up"
  });
}
//-----------//

// One device goes silent long enough to count as disconnected, then comes back.
async function dropout() {
  console.log(`Scenario: ITC-TEMP-01 goes silent for ${DROP_SECONDS} seconds.`);
  await normalCycles(5);

  console.log("  ITC-TEMP-01 has stopped sending.");
  const until = Date.now() + DROP_SECONDS * 1000;
  while (Date.now() < until) {
    await cycle({ "ITC-TEMP-01": "skip" });
    await sleep(CYCLE_MS);
  }

  console.log("  ITC-TEMP-01 is back.");
  await normalCycles(5);
}
//-----------//

// One normal reading from every sensor, which clears any active alerts.
async function recover() {
  console.log("Scenario: send one normal reading from every sensor.");
  await cycle();
}
//-----------//

// Floods the FIFO queue, then sends one critical reading to show it jumps the line.
async function burst() {
  console.log("Scenario: burst of 200 normal readings followed by one critical reading.");
  await call("POST", "/queues/delay/20");

  const floats = SENSORS.filter((s) => s.valueType === "Float" && s.deviceId !== "WS-PWR-01");
  const jobs = [];
  for (let i = 0; i < 200; i++) {
    const s = floats[i % floats.length];
    jobs.push(send(s.deviceId, jitter(s.base, s.spread)));
  }
  await Promise.all(jobs);

  const before = (await call("GET", "/queues/status")).data;
  console.log(`  Queued. Waiting in the FIFO queue right now: ${before.fifoDepth}`);

  await send("WS-PWR-01", 4200);
  console.log("  Sent one critical reading (WS-PWR-01 = 4200).");

  for (let i = 0; i < 100; i++) {
    const status = (await call("GET", "/queues/status")).data;
    if (status.fifoDepth === 0 && status.priorityDepth === 0) {
      console.log(`  Done. The critical reading was served with ${status.lastCriticalBypassedBacklog} normal readings still waiting.`);
      break;
    }
    await sleep(200);
  }

  await call("POST", "/queues/delay/0");
}
//-----------//

// Adds a believable operator history so the suggestion engine has habits to show.
async function seedHistory() {
  const { status, data } = await call("POST", "/demo/seed-history");
  console.log(status === 200 ? data.message : `${status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
}
//-----------//

// Prints the scenario list.
function help() {
  console.log(`Usage: node simulator/simulate.mjs <scenario>

  normal         steady readings from every sensor until Ctrl+C
  power-spike    Workshop power jumps past the critical limit (priority queue, critical alert)
  humidity-high  Material Storage humidity climbs (alerts, learned habit suggestions)
  server-hot     server rack temperature climbs steadily (trend prediction, then critical)
  dropout        one sensor goes silent for ${DROP_SECONDS}s (one disconnect alert, then recovery)
  recover        one normal reading from every sensor (clears alerts)
  burst          200 queued readings, then one critical reading (shows the queue bypass)
  seed-history   add demo operator history so suggestions appear straight away`);
}
//-----------//

const scenarios = {
  normal,
  "power-spike": powerSpike,
  "humidity-high": humidityHigh,
  "server-hot": serverHot,
  dropout,
  recover,
  burst,
  "seed-history": seedHistory
};

// Starts the chosen scenario after making sure the sensors exist.
async function main() {
  const name = process.argv[2];
  if (!name || name === "help" || !scenarios[name]) {
    help();
    process.exit(name && name !== "help" ? 1 : 0);
  }

  try {
    await registerAll();
  } catch (err) {
    console.error(`Could not reach the API at ${API}. Is it running? (${err.message})`);
    process.exit(1);
  }

  await scenarios[name]();
  console.log("Scenario finished.");
}
//-----------//

main();
