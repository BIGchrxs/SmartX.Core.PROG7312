import type { Route } from "../types";
import { hrefFor } from "../hooks/useHashRoute";
import { useSmartX } from "../context/SmartXContext";

interface Props {
  route: Route;
}

const LINKS: { route: Route; label: string }[] = [
  { route: "home", label: "Main menu" },
  { route: "ingestion", label: "Ingestion" },
  { route: "command", label: "Command Stream" },
];

// The menu bar shown on every page. Links only change the URL hash, so no page ever reloads.
export default function NavBar({ route }: Props) {
  const { alerts, error } = useSmartX();

  return (
    <header className="topbar">
      <a className="topbar-brand" href={hrefFor("home")}>
        Smart-X
      </a>

      <nav aria-label="Main menu">
        <ul className="topbar-links">
          {LINKS.map((link) => (
            <li key={link.route}>
              <a
                href={hrefFor(link.route)}
                className={`topbar-link ${route === link.route ? "topbar-link--active" : ""}`}
                aria-current={route === link.route ? "page" : undefined}
              >
                {link.label}
                {link.route === "command" && alerts.length > 0 && (
                  <span className="topbar-badge" title={`${alerts.length} active alert(s)`}>
                    {alerts.length}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <span className={`topbar-health ${error ? "topbar-health--down" : "topbar-health--up"}`}>
        {error ? "API unreachable" : "API connected"}
      </span>
    </header>
  );
}
//-----------//
