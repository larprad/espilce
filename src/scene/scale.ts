/**
 * Display-space constants. The scene is a stylized diagram: real *directions*
 * from the ephemeris, fake distances/sizes so everything fits in one view.
 * All physics (shadows, terminator) runs in real km via shader uniforms and
 * never touches these numbers.
 */
export const EARTH_DISPLAY_R = 1.0;
/** True Moon/Earth radius ratio (1737.4 / 6371) — kept honest. */
export const MOON_DISPLAY_R = 0.2727;
/** Real distance is ~60.3 Earth radii; compressed ~6x for readability. */
export const MOON_DISPLAY_DIST = 10.0;
export const SUN_DISPLAY_DIST = 60.0;
export const SUN_DISPLAY_R = 6.0;

export const CAMERA_WIDE: [number, number, number] = [0, 2.1, 5.6]; // distance ~6
