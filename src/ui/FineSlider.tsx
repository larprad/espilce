import { getEclipse } from "../astro/catalog";
import { useEclipseStore } from "../state/store";
import { useSimTime } from "../state/useSimTime";
import { fmtTime } from "./format";

interface Mark {
  ms: number;
  label: string;
  major?: boolean;
}

/** Hours-scale slider around the selected eclipse, with phase tick marks. */
export function FineSlider() {
  const timeMs = useSimTime();
  const setTime = useEclipseStore((s) => s.setTime);
  const window = useEclipseStore((s) => s.fineWindow);
  const selectedId = useEclipseStore((s) => s.selectedEclipseId);
  const utc = useEclipseStore((s) => s.timeDisplay === "utc");
  const eclipse = selectedId ? getEclipse(selectedId) : undefined;

  if (!window || !eclipse) return null;

  const marks: Mark[] = [{ ms: eclipse.peakMs, label: "Peak", major: true }];
  if (eclipse.type === "lunar") {
    const phases: Array<[number | null, string]> = [
      [eclipse.sdPenumMin, "Penumbral"],
      [eclipse.sdPartialMin, "Partial"],
      [eclipse.sdTotalMin, "Total"],
    ];
    for (const [sd, label] of phases) {
      if (sd && sd > 0) {
        marks.push({ ms: eclipse.peakMs - sd * 60_000, label: `${label} begins` });
        marks.push({ ms: eclipse.peakMs + sd * 60_000, label: `${label} ends` });
      }
    }
  }

  const span = window.endMs - window.startMs;
  const pct = (ms: number) => `${(100 * (ms - window.startMs)) / span}%`;

  return (
    <div className="slider-row slider-row--fine">
      <span className="slider-label">{fmtTime(window.startMs, utc)}</span>
      <div className="fine-track">
        <div className="fine-marks">
          {marks.map((m) => (
            <span
              key={`${m.label}-${m.ms}`}
              className={`fine-mark ${m.major ? "fine-mark--major" : ""}`}
              style={{ left: pct(m.ms) }}
              title={`${m.label} — ${fmtTime(m.ms, utc)}`}
            />
          ))}
        </div>
        <input
          className="slider slider--fine"
          type="range"
          min={window.startMs}
          max={window.endMs}
          step={5_000}
          value={Math.min(window.endMs, Math.max(window.startMs, timeMs))}
          onChange={(e) => setTime(Number(e.target.value))}
          aria-label="Time within eclipse window"
        />
      </div>
      <span className="slider-label">{fmtTime(window.endMs, utc)}</span>
    </div>
  );
}
