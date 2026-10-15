import { useEffect, useLayoutEffect, useRef } from "react";
import type { Route } from "../types";

// Remembers how far each page was scrolled, so coming back to a page puts you where you left it.
export function useScrollMemory(route: Route): void {
  const positions = useRef<Partial<Record<Route, number>>>({});
  const current = useRef<Route>(route);

  // Keep a running record of the scroll position for the page that is showing.
  useEffect(() => {
    // Saves the current scroll position under the page that is showing.
    function onScroll() {
      positions.current[current.current] = window.scrollY;
    }
    //-----------//

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // When the page changes, jump to where that page was last left (the top the first time).
  useLayoutEffect(() => {
    current.current = route;
    window.scrollTo(0, positions.current[route] ?? 0);
  }, [route]);
}
//-----------//
