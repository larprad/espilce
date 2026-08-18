import { memo, useEffect, useRef, useState } from "react";
import { CATALOG } from "../astro/catalog";
import type { EclipseEvent, EclipseType } from "../astro/types";
import { getSimTimeMs, useEclipseStore } from "../state/store";
import { fmtDate } from "./format";

type Filter = "all" | EclipseType;

/** Type filter and the "only total" switch compose. */
const matchesFilter = (e: EclipseEvent, filter: Filter, onlyTotal: boolean) =>
  (filter === "all" || e.type === filter) && (!onlyTotal || e.kind === "total");

/* Corona glyph — totality's badge of honor. */
const TotalityIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="totality-icon">
    <circle cx="6" cy="6" r="2.9" fill="currentColor" />
    <circle cx="6" cy="6" r="4.9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
  </svg>
);

/** Drawer listing all 681 eclipses, filterable, click to focus. Memoized so
 *  parent re-renders never reconcile the ~680 permanently-mounted rows. */
export const CatalogPanel = memo(function CatalogPanel() {
  const open = useEclipseStore((s) => s.catalogOpen);
  const selectedId = useEclipseStore((s) => s.selectedEclipseId);
  const utc = useEclipseStore((s) => s.timeDisplay === "utc");
  const { selectEclipse, setCatalogOpen } = useEclipseStore.getState();
  const [filter, setFilter] = useState<Filter>("all");
  const [onlyTotal, setOnlyTotal] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const events = CATALOG.filter((e) => matchesFilter(e, filter, onlyTotal));

  // Keep the selected row in view when the drawer opens or selection moves;
  // if the selection is filtered out, center on the event nearest the
  // current simulation date within the filtered list.
  useEffect(() => {
    if (!open) return;
    let targetId = selectedId;
    if (!listRef.current?.querySelector(`[data-id="${targetId}"]`)) {
      const t = getSimTimeMs();
      const nearest = CATALOG.filter((e) => matchesFilter(e, filter, onlyTotal)).reduce((best, e) =>
        Math.abs(e.peakMs - t) < Math.abs(best.peakMs - t) ? e : best,
      );
      targetId = nearest.id;
    }
    listRef.current?.querySelector(`[data-id="${targetId}"]`)?.scrollIntoView({ block: "center" });
  }, [open, selectedId, filter, onlyTotal]);

  // Click-away closes the dropdown. The badge (.status) is excluded — it
  // has its own toggle, and closing on its pointerdown would make the
  // subsequent click reopen it.
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (t.closest(".catalog") || t.closest(".status")) return;
      setCatalogOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open, setCatalogOpen]);

  return (
    <aside className={`catalog panel ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <header className="catalog__header">
        <h2>Eclipses 1950–2100</h2>
        <button className="btn btn--icon" onClick={() => setCatalogOpen(false)} title="Close">
          ✕
        </button>
      </header>
      <div className="catalog__filters" role="group" aria-label="Filter by type">
        {(["all", "solar", "lunar"] as const).map((f) => (
          <button
            key={f}
            className={`btn btn--filter ${filter === f ? "is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <button
          className={`btn btn--filter catalog__only-total ${onlyTotal ? "is-active" : ""}`}
          onClick={() => setOnlyTotal(!onlyTotal)}
          aria-pressed={onlyTotal}
          title="Show only total eclipses"
        >
          <TotalityIcon /> only total
        </button>
      </div>
      <div className="catalog__list" ref={listRef}>
        {events.map((e) => (
          <button
            key={e.id}
            data-id={e.id}
            className={`row ${selectedId === e.id ? "is-selected" : ""}`}
            onClick={() => {
              selectEclipse(e.id);
              setCatalogOpen(false); // picker behavior: choose and close
            }}
          >
            <span className="row__date">{fmtDate(e.peakMs, utc)}</span>
            <span className={`chip chip--${e.type}`}>{e.type}</span>
            <span className="row__kind">
              {e.kind}
              {e.kind === "total" && <TotalityIcon />}
            </span>
            <span className="row__obs">
              {e.obscuration != null ? `${Math.round(e.obscuration * 100)}%` : "—"}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
});
