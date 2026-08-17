import type { Quaternion, Vector3 } from "three";

export type EclipseType = "solar" | "lunar";

export type SolarKind = "partial" | "annular" | "total";
export type LunarKind = "penumbral" | "partial" | "total";

export interface EclipseEvent {
  id: string;
  type: EclipseType;
  kind: SolarKind | LunarKind;
  /** Peak instant, ms since epoch (UTC). */
  peakMs: number;
  /** Fraction of the Sun/Moon obscured at peak; null for partial solar. */
  obscuration: number | null;
  /** Sub-shadow geographic point at peak; solar total/annular only. */
  lat: number | null;
  lon: number | null;
  /** Lunar phase semi-durations in minutes; null for solar. */
  sdPenumMin: number | null;
  sdPartialMin: number | null;
  sdTotalMin: number | null;
}

/** Real-space geometry at one instant. Distances in km, three.js axes (ecliptic J2000, Y = north). */
export interface GeoState {
  sunKm: Vector3;
  moonKm: Vector3;
  earthQuat: Quaternion;
  moonQuat: Quaternion;
}

export const R_SUN_KM = 695700;
export const R_EARTH_KM = 6371;
export const R_MOON_KM = 1737.4;

export const MIN_TIME_MS = Date.UTC(1950, 0, 1);
export const MAX_TIME_MS = Date.UTC(2100, 11, 31, 23, 59, 59);
