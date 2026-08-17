// Generates src/data/cities.json: world cities with population >= 50k, for the
// zoom-in city layer. Data: GeoNames cities15000 (CC BY 4.0 — credited in the
// app's About popover). Run manually: npm run generate:cities
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_POPULATION = 50_000;

const tmp = mkdtempSync(join(tmpdir(), "geonames-"));
const zipPath = join(tmp, "cities15000.zip");
execSync(`curl -sfL -o "${zipPath}" https://download.geonames.org/export/dump/cities15000.zip`);
const tsv = execSync(`unzip -p "${zipPath}" cities15000.txt`, {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

// GeoNames columns: 2=asciiname (safe for the bundled latin font subset),
// 4=latitude, 5=longitude, 14=population
const cities = tsv
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const f = line.split("\t");
    return [f[2], Number(f[4]), Number(f[5]), Number(f[14])];
  })
  .filter(([, lat, lon, pop]) => pop >= MIN_POPULATION && Number.isFinite(lat) && Number.isFinite(lon))
  .sort((a, b) => b[3] - a[3])
  .map(([name, lat, lon, pop]) => [name, Number(lat.toFixed(3)), Number(lon.toFixed(3)), pop]);

// --- Self-test ---
if (cities.length < 5000 || cities.length > 15000) {
  throw new Error(`Self-test failed: unexpected city count ${cities.length}`);
}
if (!cities.some(([name]) => name === "Bilbao")) {
  throw new Error("Self-test failed: Bilbao missing");
}
for (let i = 1; i < cities.length; i++) {
  if (cities[i][3] > cities[i - 1][3]) throw new Error("Self-test failed: not sorted by population");
}

const out = join(dirname(fileURLToPath(import.meta.url)), "../src/data/cities.json");
writeFileSync(out, JSON.stringify(cities));
console.log(`Wrote ${cities.length} cities (pop >= ${MIN_POPULATION}) to ${out}`);
console.log("Self-test passed.");
