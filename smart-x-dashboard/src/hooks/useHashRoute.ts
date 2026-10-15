import { useSyncExternalStore } from "react";
import type { Route } from "../types";

const ROUTES: Route[] = ["home", "ingestion", "command"];

// Reads the current page from the URL hash, for example "#/command" gives "command".
function parseRoute(): Route {
  const name = window.location.hash.replace(/^#\/?/, "");
  return (ROUTES as string[]).includes(name) ? (name as Route) : "home";
}
//-----------//

// Lets React hear about hash changes (the back button, a clicked link, a typed URL).
function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
//-----------//

// The link target for a page. Links that only change the hash never reload the page, so state survives.
export function hrefFor(route: Route): string {
  return route === "home" ? "#/" : `#/${route}`;
}
//-----------//

// The page the URL points at right now.
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, parseRoute, () => "home" as Route);
}
//-----------//
