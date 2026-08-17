import { useEffect, useRef, useState } from "react";
import { CATALOG } from "../astro/catalog";
import type { EclipseType } from "../astro/types";
import { useEclipseStore } from "../state/store";
import { fmtDate } from "./format";

type Filter = "all" | EclipseType;

/** Right-hand drawer listing all 681 eclipses, filterable, click to focus. */
export function CatalogPanel() {
  const open = useEclipseStore((s) => s.catalogOpen);
  const selectedId = useEclipseStore((s) => s.selectedEclipseId);
  const { selectEclipse, setCatalogOpen } = useEclipseStore.getState();
  const [filter, setFilter] = useState<Filter>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const events = filter === "all" ? CATALOG : CATALOG.filter((e) => e.type === filter);

  // Keep the selected row in view when the drawer opens or selection moves.
  useEffect(() => {
    if (!open || !selectedId) return;
    listRef.current
      ?.querySelector(`[data-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [open, selectedId, filter]);

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
      </div>
      <div className="catalog__list" ref={listRef}>
        {events.map((e) => (
          <button
            key={e.id}
            data-id={e.id}
            className={`row ${selectedId === e.id ? "is-selected" : ""}`}
            onClick={() => selectEclipse(e.id)}
          >
            <span className="row__date">{fmtDate(e.peakMs)}</span>
            <span className={`chip chip--${e.type}`}>{e.type}</span>
            <span className="row__kind">{e.kind}</span>
            <span className="row__obs">
              {e.obscuration != null ? `${Math.round(e.obscuration * 100)}%` : "—"}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
