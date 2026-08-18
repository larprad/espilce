// Generates public/textures/borders_8k.png: equirectangular country borders +
// coastlines, shown by the Earth shader inside the eclipse shadow (where the
// terrain is too dark to read). Data: Natural Earth 50m (public domain).
// Rendered by system Chrome's headless screenshot (antialiased canvas lines,
// no npm dependencies). Run manually: npm run generate:borders
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 8192;
const H = 4096;
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

const CHROME =
  process.env.CHROME_BIN ??
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(
    existsSync,
  );
if (!CHROME) throw new Error("Chrome not found — set CHROME_BIN");

const fetchJson = async (name) => {
  const res = await fetch(`${NE}/${name}.geojson`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
};

const [borders, coastline] = await Promise.all([
  fetchJson("ne_50m_admin_0_boundary_lines_land"),
  fetchJson("ne_50m_coastline"),
]);

// Flatten LineString/MultiLineString features to [[lon,lat],...] polylines,
// quantized — 2 decimals ≈ 1 km, well below a texel at 4096 px/360°.
const toLines = (geojson) =>
  geojson.features.flatMap((f) =>
    f.geometry.type === "LineString"
      ? [f.geometry.coordinates]
      : f.geometry.type === "MultiLineString"
        ? f.geometry.coordinates
        : [],
  );
const quantize = (lines) => lines.map((l) => l.map(([lon, lat]) => [+lon.toFixed(2), +lat.toFixed(2)]));

const layers = [
  { lines: quantize(toLines(coastline)), width: 1.8 },
  { lines: quantize(toLines(borders)), width: 2.4 },
];
const lineCount = layers[0].lines.length + layers[1].lines.length;

const html = `<!doctype html><body style="margin:0"><canvas id="c" width="${W}" height="${H}"></canvas>
<script>
const layers = ${JSON.stringify(layers)};
const ctx = document.getElementById("c").getContext("2d");
ctx.fillStyle = "#000";
ctx.fillRect(0, 0, ${W}, ${H});
ctx.strokeStyle = "#fff";
ctx.lineJoin = "round";
ctx.lineCap = "round";
for (const { lines, width } of layers) {
  ctx.lineWidth = width;
  for (const line of lines) {
    ctx.beginPath();
    let prevX = null;
    for (const [lon, lat] of line) {
      const x = ((lon + 180) / 360) * ${W};
      const y = ((90 - lat) / 180) * ${H};
      // Split segments that jump across the antimeridian.
      if (prevX === null || Math.abs(x - prevX) > ${W / 2}) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      prevX = x;
    }
    ctx.stroke();
  }
}
</script>`;

const tmp = mkdtempSync(join(tmpdir(), "borders-"));
const htmlPath = join(tmp, "borders.html");
const pngPath = join(tmp, "borders.png");
writeFileSync(htmlPath, html);
execFileSync(CHROME, [
  "--headless=new",
  `--screenshot=${pngPath}`,
  `--window-size=${W},${H}`,
  "--force-device-scale-factor=1",
  "--virtual-time-budget=5000",
  "--disable-gpu",
  `file://${htmlPath}`,
]);
const png = readFileSync(pngPath);

// --- Self-test ---
if (png.length < 200_000 || png.length > 10_000_000) {
  throw new Error(`Self-test failed: suspicious PNG size ${png.length}`);
}
if (lineCount < 1000) throw new Error(`Self-test failed: only ${lineCount} polylines`);

const out = join(dirname(fileURLToPath(import.meta.url)), "../public/textures/borders_8k.png");
writeFileSync(out, png);
console.log(`Wrote ${(png.length / 1024).toFixed(0)} KB (${lineCount} polylines) to ${out}`);
console.log("Self-test passed.");
