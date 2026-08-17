import type { EclipseEvent } from "../astro/types";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export const fmtDate = (ms: number) => dateFmt.format(ms);
export const fmtTime = (ms: number) => `${timeFmt.format(ms)} UTC`;
export const fmtDateTime = (ms: number) => `${fmtDate(ms)} · ${fmtTime(ms)}`;

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

/** For a datetime-local input (which has no timezone), expressed in UTC. */
export function toDatetimeLocalUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16);
}
export function fromDatetimeLocalUTC(value: string): number {
  return Date.parse(`${value}:00Z`);
}
