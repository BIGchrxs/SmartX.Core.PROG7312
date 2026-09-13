import { useState } from "react";
import Landing from "./components/Landing";
import IngestionDashboard from "./components/IngestionDashboard";

type View = "landing" | "ingestion";

export default function App() {
  const [view, setView] = useState<View>("landing");

  return (
    <div className="app-shell">
      {view === "landing" ? (
        <Landing onEnterIngestion={() => setView("ingestion")} />
      ) : (
        <IngestionDashboard onBack={() => setView("landing")} />
      )}
    </div>
  );
}