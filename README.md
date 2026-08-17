# Espilce

A 3D eclipse viewer. Scrub 150 years of time (1950–2100) and watch real solar and lunar
eclipses unfold: the Moon's shadow sweeping across Earth, and the Moon turning blood-red
inside Earth's shadow. Zoom in close enough to tell which town sits inside the totality
line — every city is labeled.

![status](https://img.shields.io/badge/ephemeris-real-blue) ![license](https://img.shields.io/badge/data%20%26%20textures-CC--BY%204.0-green)

## How it works

**Two parallel spaces, one time value.**

- **Real space** — geocentric J2000-ecliptic frame in kilometres, computed per frame by
  [astronomy-engine](https://github.com/cosinekitty/astronomy). All physics happens here:
  eclipse shadows, the day/night terminator, Earth/Moon orientation (including axial tilt,
  precession, and lunar libration).
- **Display space** — what you see. Same *directions* as real space, but compressed
  distances (the Moon sits at 10 Earth radii instead of 60, the Sun is theatrical) so the
  whole system fits in one readable view. Because directions are shared, alignments —
  and therefore eclipses — read correctly.

Shadows never use shadow maps (they'd be wrong at fake distances). Instead, every fragment
of Earth and Moon reconstructs its true position in kilometres and computes the fraction
of the Sun's disc covered by the occluding body — one circle-overlap formula that yields
umbra, penumbra, and annularity, at the correct geography and time. During totality the
night-lights texture shines through the Moon's shadow: city lights come on, as they really do.

Precomputed data (committed, regenerated manually):

- `src/data/eclipses.json` — every solar and lunar eclipse 1950–2100 (~680 events).
- `src/data/cities.json` — ~12k cities (population ≥ 50k) for the zoom-in label layer.

## Develop

```bash
npm install
npm run dev
```

- `npm run generate:catalog` — regenerate the eclipse catalog (run after upgrading
  astronomy-engine; includes a self-test against known eclipses).
- `npm run generate:cities` — regenerate the city dataset from GeoNames.
- `npm run build` — production build.
- Append `?nofx` to the URL to render without postprocessing (debug).

## Controls

- **Drag** to orbit, **scroll** to zoom — both scale with altitude, so close-up
  navigation stays gentle. Zoom in far enough and city dots, then names, fade in.
- **Space** — play/pause. **Shift+←/→** — previous/next eclipse.
- **Eclipse / Earth / Moon** — camera presets. Eclipse locks on the ongoing event;
  Earth re-centers on a second click; during a selected solar eclipse the Moon view
  shows the lit Moon in front of the eclipse-shadowed Earth.
- Times are shown in **your local timezone** by default (that's how you remember an
  eclipse); a toggle in the dock switches everything to UTC.
- Pick an eclipse in the **Catalog** (opens near the current date) to get an hours-scale
  slider with phase marks.
- **Lines** — live iso-lines of Sun coverage: 25/50/75% and the totality boundary,
  cool-to-hot colors, sweeping with time.
- **Cities** — the labeled city layer (off by default).

## Credits

- Ephemeris: [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT).
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0).
- City data: [GeoNames](https://www.geonames.org/) (CC BY 4.0).
- Label font: Roboto (Apache 2.0 / OFL), bundled subset.

Built by [Larprad](https://github.com/larprad).
