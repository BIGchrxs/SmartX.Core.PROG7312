import { Suspense, lazy, useEffect, useState } from "react";
import type { Route } from "./types";
import { SmartXProvider } from "./context/SmartXContext";
import { useHashRoute } from "./hooks/useHashRoute";
import { useScrollMemory } from "./hooks/useScrollMemory";
import NavBar from "./components/NavBar";

// Each pillar is its own bundle, fetched the first time you open it rather than on first paint.
// Vite splits these into separate chunks, so the menu appears without waiting for code nobody has asked for yet.
const Landing = lazy(() => import("./components/Landing"));
const IngestionDashboard = lazy(() => import("./components/IngestionDashboard"));
const CommandStream = lazy(() => import("./components/CommandStream"));
const Topology = lazy(() => import("./components/Topology"));

const TITLES: Record<Route, string> = {
  home: "Smart-X | Studio HQ gateway",
  ingestion: "Smart-X | Sensor Data Ingestion",
  command: "Smart-X | Command Stream",
  topology: "Smart-X | Network Topology",
};

const LABELS: Record<Route, string> = {
  home: "Main menu",
  ingestion: "Sensor data ingestion",
  command: "Command stream",
  topology: "Network topology",
};

const PAGES: Record<Route, React.ComponentType> = {
  home: Landing,
  ingestion: IngestionDashboard,
  command: CommandStream,
  topology: Topology,
};

// The app shell. A page is loaded the first time it is opened and then stays mounted, only hidden,
// so typed text, search boxes, selections and scroll positions are all still there when you come back.
export default function App() {
  const route = useHashRoute();
  useScrollMemory(route);

  // Every page opened so far. A page leaves this set only when the tab closes, which is what keeps its state.
  const [opened, setOpened] = useState<Route[]>(() => [route]);

  useEffect(() => {
    setOpened((previous) => (previous.includes(route) ? previous : [...previous, route]));
  }, [route]);

  useEffect(() => {
    document.title = TITLES[route];
  }, [route]);

  return (
    <SmartXProvider>
      <div className="app-shell">
        <NavBar route={route} />
        <main>
          {opened.map((name) => {
            const Page = PAGES[name];
            return (
              <section key={name} hidden={route !== name} aria-label={LABELS[name]}>
                <Suspense fallback={<p className="empty-state">Loading {LABELS[name].toLowerCase()}.</p>}>
                  <Page />
                </Suspense>
              </section>
            );
          })}
        </main>
      </div>
    </SmartXProvider>
  );
}
//-----------//
