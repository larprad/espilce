# Espilce

A 3D eclipse viewer. Scrub 150 years of time (1950–2100) and watch real solar and lunar
eclipses unfold: the Moon's shadow sweeping across Earth, and the Moon turning blood-red
inside Earth's shadow.

![status](https://img.shields.io/badge/ephemeris-real-blue) ![license](https://img.shields.io/badge/textures-CC--BY%204.0-green)

## How it works

**Two parallel spaces, one time value.**

- **Real space** — geocentric J2000-ecliptic frame in kilometres, computed per frame by
  [astronomy-engine](https://github.com/cosinekitty/astronomy). All physics happens here:
  eclipse shadows, the day/night terminator, Earth/Moon orientation (including precession
  and lunar libration).
- **Display space** — what you see. Same *directions* as real space, but compressed
  distances (the Moon sits at 10 Earth radii instead of 60, the Sun is theatrical) so the
  whole system fits in one readable view. Because directions are shared, alignments —
  and therefore eclipses — read correctly.

Shadows never use shadow maps (they'd be wrong at fake distances). Instead, every fragment
of Earth and Moon reconstructs its true position in kilometres and computes the fraction
of the Sun's disc covered by the occluding body — one circle-overlap formula that yields
umbra, penumbra, and annularity, at the correct geography and time.

The eclipse catalog (~680 events) is precomputed at build time into `src/data/eclipses.json`.

## Develop

```bash
npm install
npm run dev
```

- `npm run generate:catalog` — regenerate the eclipse catalog (run after upgrading
  astronomy-engine; includes a self-test against known eclipses).
- `npm run build` — production build.
- Append `?nofx` to the URL to render without postprocessing (debug).

## Controls

- **Drag** to orbit, **scroll** to zoom.
- **Space** — play/pause. **Shift+←/→** — previous/next eclipse.
- Times are shown in **your local timezone** by default (that's how you remember an
  eclipse); a toggle in the dock switches everything to UTC.
- Pick an eclipse in the **Catalog** to get an hours-scale slider with phase marks.
- **Boost shadow** widens the umbra/penumbra for visibility (clearly non-physical).

## Credits

- Ephemeris: [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT).
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0).
