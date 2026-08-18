# Espilce — Architecture notes

3D Sun–Earth–Moon eclipse viewer. Vite + React 19 + TypeScript + react-three-fiber +
@react-three/drei + @react-three/postprocessing + zustand. Ephemeris: `astronomy-engine`
(pure JS). Read this before adding features — the invariants below are load-bearing.

## The core invariant: two spaces, one time value

- **Real space** (physics): geocentric **J2000-ecliptic** frame, kilometres, straight from
  astronomy-engine. ALL physics runs here: eclipse shadows, terminator, orientations.
- **Display space** (rendering): same *directions*, fake distances/radii
  ([scale.ts](src/scene/scale.ts): Earth r=1 at origin, Moon at 10 units instead of 60,
  Sun at 60 with r=6). `displayPos = normalize(realKmVector) * DISPLAY_DIST`.

Because directions are shared, alignments (= eclipses) read correctly on screen while the
shadow math stays physically exact. **Never use three.js shadow maps** — they'd be wrong at
fake distances. Shadows are computed analytically per-fragment in real km via uniforms.

## Frames & axis conventions (the #1 source of past bugs)

- astronomy-engine vectors are right-handed **Z-up**; the scene is three.js **Y-up** with
  the ecliptic as the XZ plane. Bridge: `(x, y, z) → (x, z, −y)` (proper rotation).
- EQJ (equatorial J2000) → ecliptic via `Rotation_EQJ_ECL()` (module-scope constant).
  **Both** position vectors AND body-axis vectors must go through EQJ→ECL before the
  bridge — skipping it for the axes was the "no axial tilt" bug (terminator off ±23.4°).
- Body orientation ([frames.ts](src/astro/frames.ts)): **Earth uses `earthOrientation()`**
  (GAST + equator-of-date via `SiderealTime` + `Rotation_EQD_EQJ`). **Never use
  `RotationAxis(Body.Earth)`** — its IAU node (equator-of-date ∩ J2000 equator) is
  numerically degenerate near the year 2000: it put the 1999-08-11 eclipse 154° of
  longitude away from France and left a ~0.9° residual even in the 2020s. The Moon keeps
  `quatFromAxisInfo(RotationAxis(Body.Moon))` (well-conditioned node + libration).
- Mesh calibration: three.js SphereGeometry has poles on ±Y and the equirect prime
  meridian on +X ⇒ every body mesh gets `rotation-x={MESH_CALIBRATION_X}` (+90° about X,
  defined in [Earth.tsx](src/scene/Earth.tsx)). City markers live inside the same
  calibrated group and use [geo.ts](src/scene/geo.ts) `latLonToMeshDir`.
- **Oblateness**: the mesh is a sphere, but eclipse coverage is evaluated at the true
  WGS84 surface position (`vGeoPosKm` computed trig-free in the shared vertex shader,
  [eclipseCommon.ts](src/scene/shaders/eclipseCommon.ts)). Sphere-only evaluation misplaced
  the umbra by ~20 km at 43° latitude — enough to flip a city out of totality.

## Shaders ([src/scene/shaders/](src/scene/shaders/))

- `eclipseCommon.ts` — `sunCoverage(P, sun, occluder, occR)`: fraction of the Sun's disc
  covered, via circle–circle overlap of angular radii. One formula yields umbra, penumbra
  and annularity. Precision rules: use `2·asin(½|â−b̂|)` for tiny angles (never
  `acos(dot)`), and **clamp the result to [0,1]** — a hair-negative area fed to `pow()`
  produces NaN, and bloom smears one NaN pixel across the whole frame (past bug).
- `earthMaterial.ts` — day/night texture blend on real terminator, night city-lights that
  emerge under eclipse shadow (physical), fresnel rim, coverage darkening, and the
  optional "Lines" overlay: iso-lines at 25/50/75% + totality boundary at **0.999**
  (not 1.0 — the model has a few-km systematic under-coverage; 0.999 tracks the true edge
  best), faded past the terminator (`smoothstep` on ndl).
- `moonMaterial.ts` — blood-moon: `sunTerm·(1−cov) + red·cov³`, Earth occluder radius
  ×1.02 (standard atmospheric umbra enlargement).
- Materials output **linear** color; the postprocessing composer does tone mapping (ACES)
  + sRGB. `EffectComposer multisampling={0}` — MSAA on the float buffer causes block
  artifacts on some GPUs.

## Time engine ([store.ts](src/state/store.ts)) — zero React work during playback

Derived-time model: `simTime = baseSimMs + (performance.now() − basePerfMs)·speed`;
`basePerfMs === null` = paused. Playback writes **nothing** to the store.
- Scene: [SimulationDriver.tsx](src/scene/SimulationDriver.tsx) in `useFrame` calls
  `useEclipseStore.getState()` (no subscription), runs `computeGeoState(t)` (<1 ms), and
  mutates mesh transforms + shader uniforms via the [sceneRefs.ts](src/scene/sceneRefs.ts)
  registry. **No allocations in the frame loop** — module-scope scratch Vector3s.
- UI: components read time via [useSimTime.ts](src/state/useSimTime.ts) (8 Hz poll while
  playing + store subscription). Any mutation (`setTime/setSpeed/play/pause`) re-anchors
  `baseSimMs` so the instant never jumps.
- Rule for new features: per-frame values go through refs/uniforms in the driver or a
  component-local `useFrame`; React state is for interaction-rate changes only.

## Camera ([SimulationDriver.tsx](src/scene/SimulationDriver.tsx))

- drei `CameraControls` (camera-controls lib), `makeDefault`.
- Presets earth/moon/sun: on click (or eclipse selection) a smooth `setLookAt` flight;
  **every preset pins its orbit target every frame** (`setTarget`, no transition) — Earth
  to the origin, Moon to the moving body — so interrupted flights can never leave the
  camera orbiting the wrong point. `cameraPresetSeq` bumps on every click so re-clicking
  the active preset re-aims (Earth doubles as "recenter").
- Altitude-proportional feel: `dollySpeed = azimuthRotateSpeed = polarRotateSpeed =
  clamp(a/(a+1), 0.07, 1)` per frame, where `a` = altitude above the surface
  (`d−1` for center targets, `d` for the eclipse lock's surface target, which also
  gets `minDistance 0.3` instead of the global 1.3 so closest approach matches Earth).
- "eclipse" preset: locks on the ongoing eclipse (shadow-axis surface point for solar,
  Moon for lunar); the camera rotates around Earth with the sweeping shadow each frame
  (position hard-set gated on `!controls.active`), auto-reverts to Earth when the
  eclipse window ends. Button enabled via `activeEclipse()` (catalog.ts).
  **Selecting an eclipse switches to this lock automatically** so the phenomenon is
  always in view. An eclipse is ALWAYS selected; the store boots with the nearest to now,
  time paused at peak−45 min, preset "eclipse", and the driver frames it on mount
  (`aimEclipseLock`, no transition, behind the loading screen; solar lock distance =
  `ECLIPSE_LOCK_DIST` = 3.4 Earth radii). The top-center badge toggles the catalog
  dropdown and is flanked by prev/next arrows — there is no separate Catalog button or
  deselect.

## Data (committed, regenerated manually)

- [scripts/generate-catalog.mjs](scripts/generate-catalog.mjs) → `src/data/eclipses.json`:
  every solar+lunar eclipse 1950–2100 (~680), sorted by `peakMs`, with self-test anchors.
  astronomy-engine quirks: `Next*Eclipse` takes the previous **peak time** (not the info
  object); annular eclipses DO get `latitude/longitude` despite the doc comment.
  Regenerate when upgrading astronomy-engine (version-pin matters).
- [scripts/generate-cities.mjs](scripts/generate-cities.mjs) → `src/data/cities.json`:
  GeoNames cities ≥50k pop, `[asciiName, lat, lon, pop]` sorted by pop desc. ASCII names
  on purpose — the bundled label font (`public/fonts/Roboto-Regular.woff`, latin subset,
  17 KB) has no extended glyphs; troika must NOT fall back to its CDN-loaded default font.

## City layer ([CityLayer.tsx](src/scene/CityLayer.tsx))

Dots = one `THREE.Points` in the calibrated Earth frame (rotate with the planet for free).
Labels = pool of 40 troika `Text` objects, ALSO children of that frame (world-space
parenting made them stutter during playback); billboarding in a rotating parent is
`localQ = parentWorldQ⁻¹ · cameraQ`. Selection refresh every 0.3 s: keep-if-still-visible
pass first (set stability > greedy optimality), then fill by population with angular
separation; opacity fades instead of pops. Screen-constant font size, quantized in 8%
steps to avoid troika re-layout churn. Labels have `depthTest=false` (horizon culling is
ours; depth-testing billboards against the sphere clips them).

## UI layout ([HUD.tsx](src/ui/HUD.tsx), [hud.css](src/styles/hud.css))

Stage layout, same structure on desktop and mobile: **top-left** = brand only;
**top-center** = the eclipse picker `‹ [badge ▾] ›` — an eclipse is always selected, the
badge click opens the catalog as a centered dropdown beneath it (auto-scrolled to the
selection, closes on pick); **bottom stack** (`.hud__bottom-stack`, one flex column on
all widths) = Lines legend, then the view bar (Eclipse/Earth/Moon ‖ Lines/Cities/?),
then the time dock (play, datetime with seconds — totality can last <60 s — timezone
toggle, speeds, the event fine-slider; there is no coarse timeline slider).

Times display in the viewer's **local timezone by default** (UTC toggle) — users remember
eclipses in local time; the datetime-local input is fed wall-clock digits per mode
([format.ts](src/ui/format.ts)).

Mobile (≤720px) diverges only in compactness: smaller buttons, speed buttons swap to a
native `<select className="speed-select">` (renders as a detached mini-popup in Chrome
device emulation — known cosmetic limitation), TZ toggle hidden, bigger slider thumb.

## Verification anchors (used repeatedly; keep using them)

- **2026-08-12 solar, Bilbao (43.263 N, 2.925 W)**: local totality 18:27:11–18:27:47 UTC
  (36 s, sun alt 8.3°) — the user's real-world observation; the totality line must
  enclose Bilbao around 18:27:22.
- **2024-04-08 solar**: peak 18:17:19 UTC, umbra at 25.3 N / 104.1 W (northern Mexico).
- **1999-08-11 solar, Reims (49.26 N, 4.03 E)**: totality 10:24:30–10:26:33 UTC — the
  regression that exposed the RotationAxis(Earth) singularity; the totality line must
  cross northern France (Normandy–Reims–Strasbourg).
- **2023-10-14 annular**: never fully dark; no 100% line anywhere.
- **2025-03-14 lunar**: blood moon at 06:58 UTC (Moon camera preset).
- Subsolar longitude ≈ 0° at any 12:00 UTC (±2.5° equation of time).
- Cross-check ground truth with `SearchLocalSolarEclipse(date, new Observer(lat, lon, h))`.

Browser verification pattern: headless Chrome (playwright-core, `channel: "chrome"`)
against `npm run dev`; `window.__r3f` (DEV-only, set in SceneRoot `onCreated`) exposes the
R3F state — use `__r3f.get()` for live values (the snapshot goes stale). `?nofx` URL param
disables postprocessing. Set the browser timezone (`timezoneId`) when testing time display.

## Commands

- `npm run dev` / `npm run build` / `npx tsc -b` / `npx oxlint src scripts`
- `npm run generate:catalog`, `npm run generate:cities` (network needed; outputs committed)

## Repo etiquette

Commit/push only with the user's explicit approval (remote:
`git@github.com:larprad/espilce.git`). Textures are CC-BY Solar System Scope, city data
CC-BY GeoNames — keep the attributions in the About popover and README.
