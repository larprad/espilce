import { getEclipse } from "../astro/catalog";
import { useEclipseStore } from "../state/store";
import { eclipseTitle, fmtDateTime } from "./format";

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

  const eclipse = getEclipse(selectedId)!;

  return (
    <button
      className={`status panel ${catalogOpen ? "is-open" : ""}`}
      onClick={() => setCatalogOpen(!catalogOpen)}
      title="Change eclipse"
      aria-haspopup="listbox"
      aria-expanded={catalogOpen}
    >
      <span className={`chip chip--${eclipse.type}`}>{eclipse.type}</span>
      <span className="status__body">
        <span className="status__title">{eclipseTitle(eclipse)}</span>
        <span className="status__meta">{fmtDateTime(eclipse.peakMs, utc)}</span>
      </span>
    </button>
  );
}
