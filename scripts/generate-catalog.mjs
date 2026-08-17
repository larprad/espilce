// Generates src/data/eclipses.json: every solar + lunar eclipse 1950–2100.
// Run manually after upgrading astronomy-engine: npm run generate:catalog
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NextGlobalSolarEclipse,
  NextLunarEclipse,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
} from "astronomy-engine";

const START = new Date("1950-01-01T00:00:00Z");
const END_MS = Date.UTC(2101, 0, 1);

const round = (x, digits) => (x == null ? null : Number(x.toFixed(digits)));

const events = [];

let s = SearchGlobalSolarEclipse(START);
while (s.peak.date.getTime() < END_MS) {
  events.push({
    id: `solar-${s.peak.date.toISOString().slice(0, 10)}`,
    type: "solar",
    kind: s.kind,
    peakMs: s.peak.date.getTime(),
    obscuration: round(s.obscuration, 4) ?? null,
    lat: round(s.latitude, 2) ?? null,
    lon: round(s.longitude, 2) ?? null,
    sdPenumMin: null,
    sdPartialMin: null,
    sdTotalMin: null,
  });
  s = NextGlobalSolarEclipse(s.peak);
}

let l = SearchLunarEclipse(START);
while (l.peak.date.getTime() < END_MS) {
  events.push({
    id: `lunar-${l.peak.date.toISOString().slice(0, 10)}`,
    type: "lunar",
    kind: l.kind,
    peakMs: l.peak.date.getTime(),
    obscuration: round(l.obscuration, 4),
    lat: null,
    lon: null,
    sdPenumMin: round(l.sd_penum, 1),
    sdPartialMin: round(l.sd_partial, 1),
    sdTotalMin: round(l.sd_total, 1),
  });
  l = NextLunarEclipse(l.peak);
}

events.sort((a, b) => a.peakMs - b.peakMs);

// --- Self-test: well-known anchor events must be present with correct kinds ---
const anchors = [
  ["solar-2017-08-21", "total"],
  ["solar-2023-10-14", "annular"],
  ["solar-2024-04-08", "total"],
  ["solar-2026-08-12", "total"],
  ["lunar-2025-03-14", "total"],
];
for (const [id, kind] of anchors) {
  const e = events.find((ev) => ev.id === id);
  if (!e) throw new Error(`Self-test failed: ${id} missing from catalog`);
  if (e.kind !== kind) throw new Error(`Self-test failed: ${id} kind=${e.kind}, expected ${kind}`);
}
const peak2024 = events.find((e) => e.id === "solar-2024-04-08");
if (Math.abs(peak2024.peakMs - Date.UTC(2024, 3, 8, 18, 17, 19)) > 60_000) {
  throw new Error("Self-test failed: 2024-04-08 peak time off by more than a minute");
}

const out = join(dirname(fileURLToPath(import.meta.url)), "../src/data/eclipses.json");
writeFileSync(out, JSON.stringify(events));

const solar = events.filter((e) => e.type === "solar").length;
console.log(`Wrote ${events.length} events (${solar} solar, ${events.length - solar} lunar) to ${out}`);
console.log("Self-test passed: all anchor eclipses present with expected kinds.");
