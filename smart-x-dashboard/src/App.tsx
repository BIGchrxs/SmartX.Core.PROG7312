import { useEffect } from "react";
import type { Route } from "./types";
import { SmartXProvider } from "./context/SmartXContext";
import { useHashRoute } from "./hooks/useHashRoute";
import { useScrollMemory } from "./hooks/useScrollMemory";
import NavBar from "./components/NavBar";
import Landing from "./components/Landing";
import IngestionDashboard from "./components/IngestionDashboard";
import CommandStream from "./components/CommandStream";

const TITLES: Record<Route, string> = {
  home: "Smart-X | Studio HQ gateway",
  ingestion: "Smart-X | Sensor Data Ingestion",
  command: "Smart-X | Command Stream",
};

// The app shell. Every page stays mounted and the inactive ones are only hidden,
// so typed text, search boxes, selections and scroll positions are all still there when you come back.
export default function App() {
  const route = useHashRoute();
  useScrollMemory(route);

  useEffect(() => {
    document.title = TITLES[route];
  }, [route]);

  return (
    <SmartXProvider>
      <div className="app-shell">
        <NavBar route={route} />
        <main>
          <section hidden={route !== "home"} aria-label="Main menu">
            <Landing />
          </section>
          <section hidden={route !== "ingestion"} aria-label="Sensor data ingestion">
            <IngestionDashboard />
          </section>
          <section hidden={route !== "command"} aria-label="Command stream">
            <CommandStream />
          </section>
        </main>
      </div>
    </SmartXProvider>
  );
}
//-----------//
