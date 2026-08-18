import type { EclipseEvent } from "../astro/types";

/**
 * All formatters take `utc`: false = the viewer's local timezone (default
 * presentation — people remember eclipses in their local time), true = UTC.
 */

const dateFmt = (utc: boolean) =>
  new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: utc ? "UTC" : undefined,
  });
const timeFmt = (utc: boolean) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: utc ? "UTC" : undefined,
  });

const FMT = {
  date: { local: dateFmt(false), utc: dateFmt(true) },
  time: { local: timeFmt(false), utc: timeFmt(true) },
};

const pick = (utc: boolean): "utc" | "local" => (utc ? "utc" : "local");

export const fmtDate = (ms: number, utc: boolean) => FMT.date[pick(utc)].format(ms);
export const fmtTime = (ms: number, utc: boolean) => FMT.time[pick(utc)].format(ms);

/** Seconds → "36 s" / "2 min 08 s". */
export function fmtDurationSec(totalSec: number): string {
  const s = Math.round(totalSec);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}
export const fmtDateTime = (ms: number, utc: boolean) =>
  `${fmtDate(ms, utc)} · ${fmtTime(ms, utc)}`;

/** Short name of the zone currently displayed, e.g. "CEST" or "UTC". */
export function zoneLabel(utc: boolean): string {
  const parts = FMT.time[pick(utc)].formatToParts(Date.now());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? (utc ? "UTC" : "local");
}

export function fmtCountdown(fromMs: number, toMs: number): string {
  const delta = toMs - fromMs;
  const abs = Math.abs(delta);
  const min = Math.round(abs / 60_000);
  const parts =
    min < 1
      ? "now"
      : min < 60
        ? `${min} min`
        : min < 48 * 60
          ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} m` : ""}`.trim()
          : `${Math.round(min / 1440)} days`;
  if (parts === "now") return "peak now";
  return delta > 0 ? `peak in ${parts}` : `peak ${parts} ago`;
}

/** Minutes → "1 h 07 min" / "36 min". */
export function fmtDurationMin(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** "65.2°N, 25.3°W" */
export function fmtLatLon(lat: number, lon: number): string {
  const ns = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
  const ew = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
  return `${ns}, ${ew}`;
}

export function eclipseTitle(e: EclipseEvent): string {
  const kind = e.kind.charAt(0).toUpperCase() + e.kind.slice(1);
  return `${kind} ${e.type} eclipse`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Value for a datetime-local input (seconds included — totality can last
 * under a minute). The control is timezone-less; we feed it wall-clock
 * digits in the chosen zone and parse them back symmetrically.
 */
export function toDatetimeInput(ms: number, utc: boolean): string {
  const d = new Date(ms);
  return utc
    ? d.toISOString().slice(0, 19)
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fromDatetimeInput(value: string, utc: boolean): number {
  // The control omits ":ss" when seconds are zero; normalize before parsing.
  const v = value.length === 16 ? `${value}:00` : value;
  // In local mode a bare datetime string parses in the viewer's timezone.
  return Date.parse(utc ? `${v}Z` : v);
}
