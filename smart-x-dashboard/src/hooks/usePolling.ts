import { useEffect, useRef } from "react";

// Runs a task now and then every intervalMs until the component unmounts.
// A slow request never overlaps with the next one, and a changing callback does not reset the timer.
export function usePolling(task: () => Promise<void>, intervalMs: number): void {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    let stopped = false;
    let running = false;

    // Runs one round unless the previous one is still going.
    async function tick() {
      if (running || stopped) return;
      running = true;
      try {
        await taskRef.current();
      } finally {
        running = false;
      }
    }

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [intervalMs]);
}
//-----------//
