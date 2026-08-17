import { MAX_TIME_MS, MIN_TIME_MS } from "../astro/types";
import { useEclipseStore } from "../state/store";
import { useSimTime } from "../state/useSimTime";

const DAY_MS = 86_400_000;

/** Full-range (1950–2100) slider, day granularity. */
export function CoarseSlider() {
  const timeMs = useSimTime();
  const setTime = useEclipseStore((s) => s.setTime);

  return (
    <div className="slider-row">
      <span className="slider-label">1950</span>
      <input
        className="slider"
        type="range"
        min={MIN_TIME_MS}
        max={MAX_TIME_MS}
        step={DAY_MS}
        value={timeMs}
        onChange={(e) => setTime(Number(e.target.value))}
        aria-label="Date (1950–2100)"
      />
      <span className="slider-label">2100</span>
    </div>
  );
}
