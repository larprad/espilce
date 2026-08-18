import { getEclipse } from "../astro/catalog";
import { useEclipseStore } from "../state/store";
import { eclipseTitle, fmtDate, fmtTime } from "./format";

/**
 * The selected-eclipse badge — the app's navigation hub. Always populated
 * (an eclipse is always selected); clicking it opens the catalog to pick
 * another one.
 */
export function EclipseStatus() {
  const selectedId = useEclipseStore((s) => s.selectedEclipseId);
  const catalogOpen = useEclipseStore((s) => s.catalogOpen);
  const setCatalogOpen = useEclipseStore((s) => s.setCatalogOpen);
  const utc = useEclipseStore((s) => s.timeDisplay === "utc");
  // One soft glow after the loading screen fades — a glance magnet toward
  // the app's navigation hub (the animation's own delay waits out the fade).
  const sceneReady = useEclipseStore((s) => s.sceneReady);

  const eclipse = getEclipse(selectedId)!;

  return (
    <button
      className={`status panel ${catalogOpen ? "is-open" : ""} ${sceneReady ? "status--pulse" : ""}`}
      onClick={() => setCatalogOpen(!catalogOpen)}
      title="Change eclipse"
      aria-haspopup="listbox"
      aria-expanded={catalogOpen}
    >
      <span className={`chip chip--${eclipse.type}`}>{eclipse.type}</span>
      <span className="status__body">
        <span className="status__title">{eclipseTitle(eclipse)}</span>
        <span className="status__meta">
          <span className="status__date">{fmtDate(eclipse.peakMs, utc)}</span>
          {" · "}
          {fmtTime(eclipse.peakMs, utc)}
        </span>
      </span>
    </button>
  );
}
