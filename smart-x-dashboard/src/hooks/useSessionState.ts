import { useCallback, useState } from "react";

// Like useState, but the value also survives a page refresh (it lives in sessionStorage for this tab).
// If storage is blocked it quietly behaves like plain useState.
export function useSessionState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage is unavailable, so the value only lives in memory.
      }
    },
    [key]
  );

  return [value, update];
}
//-----------//
