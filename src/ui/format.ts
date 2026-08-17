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
