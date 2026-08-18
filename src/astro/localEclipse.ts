import { EclipseKind, Observer, SearchLocalSolarEclipse } from "astronomy-engine";
import { eclipseHalfWindowMs, getEclipse } from "./catalog";

export interface LocalCircumstances {
  /** false = this eclipse can't be seen from that point at all. */
  visible: boolean;
  /** Fraction of the Sun's disc covered at the local maximum. */
  obscuration: number;
  kind: "total" | "annular" | "partial";
  /** Totality (or annularity) start/end at this point, null for partial. */
  centralBeginMs: number | null;
  centralEndMs: number | null;
}

/**
 * Exact local circumstances of a solar eclipse at a ground point, straight
 * from astronomy-engine — the same call the verification anchors use.
 * Used for the About popover's "totality up to …" fact, evaluated at the
 * greatest-eclipse point (where the duration is longest).
 * SearchLocalSolarEclipse returns the NEXT eclipse visible from the point;
 * if that lands outside the selected event's window, this one isn't visible
 * from there.
 */
export function localSolarCircumstances(
  eclipseId: string,
  lat: number,
  lon: number,
): LocalCircumstances {
  const e = getEclipse(eclipseId)!;
  const half = eclipseHalfWindowMs(e);
  const info = SearchLocalSolarEclipse(new Date(e.peakMs - half), new Observer(lat, lon, 0));
  const peakMs = info.peak.time.date.getTime();
  if (Math.abs(peakMs - e.peakMs) > half) {
    return {
      visible: false,
      obscuration: 0,
      kind: "partial",
      centralBeginMs: null,
      centralEndMs: null,
    };
  }
  return {
    visible: true,
    obscuration: info.obscuration,
    kind:
      info.kind === EclipseKind.Total
        ? "total"
        : info.kind === EclipseKind.Annular
          ? "annular"
          : "partial",
    centralBeginMs: info.total_begin?.time.date.getTime() ?? null,
    centralEndMs: info.total_end?.time.date.getTime() ?? null,
  };
}
