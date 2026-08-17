import { useEffect, useState } from "react";
import { getSimTimeMs, useEclipseStore } from "./store";

/**
 * Simulation time for UI components, sampled at `hz` while playing and
 * updated immediately on any store change (scrub, pause, jump). Keeps
 * React rendering at a few Hz instead of 60 fps.
 */
export function useSimTime(hz = 8): number {
  const [timeMs, setTimeMs] = useState(getSimTimeMs);

  useEffect(() => {
    const update = () => setTimeMs(getSimTimeMs());
    const unsubscribe = useEclipseStore.subscribe(update);
    const interval = setInterval(() => {
      // Only tick while playing; paused time can't drift.
      if (useEclipseStore.getState().basePerfMs !== null) update();
    }, 1000 / hz);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [hz]);

  return timeMs;
}
