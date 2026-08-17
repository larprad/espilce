import { getEclipse, nearestEclipse } from "../astro/catalog";
import { useEclipseStore } from "../state/store";
import { useSimTime } from "../state/useSimTime";
import { eclipseTitle, fmtCountdown, fmtDateTime } from "./format";

/** Top-left badge: the selected (or nearest) eclipse and a live countdown. */
export function EclipseStatus() {
  const timeMs = useSimTime();
  const selectedId = useEclipseStore((s) => s.selectedEclipseId);
  const selectEclipse = useEclipseStore((s) => s.selectEclipse);
  const utc = useEclipseStore((s) => s.timeDisplay === "utc");

  const eclipse = (selectedId && getEclipse(selectedId)) || nearestEclipse(timeMs);
  const isSelected = selectedId === eclipse.id;

  return (
    <button
      className={`status panel ${isSelected ? "is-selected" : ""}`}
      onClick={() => selectEclipse(isSelected ? null : eclipse.id)}
      title={isSelected ? "Deselect eclipse" : "Focus this eclipse"}
    >
      <span className={`chip chip--${eclipse.type}`}>{eclipse.type}</span>
      <span className="status__body">
        <span className="status__title">{eclipseTitle(eclipse)}</span>
        <span className="status__meta">
          {fmtDateTime(eclipse.peakMs, utc)} — {fmtCountdown(timeMs, eclipse.peakMs)}
        </span>
      </span>
    </button>
  );
}
