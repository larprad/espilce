import { useFrame, useThree } from "@react-three/fiber";
import type CameraControls from "camera-controls";
import { useEffect, useRef } from "react";
import { MathUtils, Quaternion, Vector3 } from "three";
import { activeEclipse } from "../astro/catalog";
import { computeGeoState } from "../astro/ephemeris";
import { R_EARTH_KM, type GeoState } from "../astro/types";
import { getSimTimeMs, useEclipseStore } from "../state/store";
import { CAMERA_WIDE, MOON_DISPLAY_DIST, SUN_DISPLAY_DIST } from "./scale";
import { sceneRefs } from "./sceneRefs";

const _dir = new Vector3();
const _perp = new Vector3();
const _target = new Vector3();
const _curTarget = new Vector3();
const _axis = new Vector3();
const _prevLock = new Vector3(); // zero-length = lock not engaged
const _lockQ = new Quaternion();
const _camPos = new Vector3();
let _prevSimT = Number.NaN;

/**
 * Where a solar eclipse is "happening" on Earth right now: the unit direction
 * of the shadow-axis intersection with the surface, or — while the axis
 * misses Earth (partial phases / partial-only eclipses) — the surface point
 * closest to the axis, which is where coverage peaks.
 */
function shadowLockDir(gs: GeoState, out: Vector3): Vector3 {
  _axis.copy(gs.moonKm).sub(gs.sunKm).normalize();
  const b = gs.moonKm.dot(_axis);
  const disc = b * b - (gs.moonKm.lengthSq() - R_EARTH_KM * R_EARTH_KM);
  if (disc >= 0) {
    const s = -b - Math.sqrt(disc);
    if (s > 0) return out.copy(gs.moonKm).addScaledVector(_axis, s).normalize();
  }
  return out.copy(gs.moonKm).addScaledVector(_axis, -b).normalize();
}

/** Camera distance (Earth radii from the center) of the solar eclipse lock. */
const ECLIPSE_LOCK_DIST = 3.4;

/**
 * Pin the orbit target ONLY when it actually moved. Calling setTarget every
 * frame would rebase camera-controls' damped sphericals to the current
 * position, killing the post-release glide (drag momentum) whenever a preset
 * is active — the epsilon skip keeps the pin and the momentum.
 */
function pinTarget(c: CameraControls, x: number, y: number, z: number) {
  c.getTarget(_curTarget);
  const dx = _curTarget.x - x;
  const dy = _curTarget.y - y;
  const dz = _curTarget.z - z;
  if (dx * dx + dy * dy + dz * dz > 1e-10) c.setTarget(x, y, z, false);
}

/**
 * Eclipse-lock camera: hover above the shadow's maximum point for solar,
 * face the Moon's near side for lunar. Falls back to the wide Earth view
 * when no eclipse is active at the current time.
 */
function aimEclipseLock(c: CameraControls, selectedEclipseId: string, transition: boolean) {
  const t = getSimTimeMs();
  const gs = computeGeoState(t);
  const e = activeEclipse(t, selectedEclipseId);
  if (!e) {
    aimEarthView(c, selectedEclipseId, transition);
  } else if (e.type === "lunar") {
    // Close-up on the near side: ~2 display units from the Moon puts its
    // disc at ~15° across — near full width on a phone screen, a generous
    // blood moon on desktop.
    _dir.copy(gs.moonKm).normalize().multiplyScalar(MOON_DISPLAY_DIST);
    c.setLookAt(_dir.x * 0.8, _dir.y * 0.8 + 0.4, _dir.z * 0.8, _dir.x, _dir.y, _dir.z, transition);
  } else {
    shadowLockDir(gs, _dir);
    c.setLookAt(
      _dir.x * ECLIPSE_LOCK_DIST,
      _dir.y * ECLIPSE_LOCK_DIST,
      _dir.z * ECLIPSE_LOCK_DIST,
      _dir.x,
      _dir.y,
      _dir.z,
      transition,
    );
  }
}

/**
 * Wide Earth view, oriented so the selected eclipse faces the camera (solar:
 * shadow side; lunar: the Moon sits between camera and Earth). Falls back to
 * the plain wide view when no eclipse is active at the current time.
 */
function aimEarthView(c: CameraControls, selectedEclipseId: string, transition: boolean) {
  const t = getSimTimeMs();
  const e = activeEclipse(t, selectedEclipseId);
  if (e) {
    const gs = computeGeoState(t);
    const d = Math.hypot(...CAMERA_WIDE);
    if (e.type === "solar") shadowLockDir(gs, _dir);
    else _dir.copy(gs.moonKm).normalize();
    c.setLookAt(_dir.x * d, _dir.y * d, _dir.z * d, 0, 0, 0, transition);
  } else {
    c.setLookAt(...CAMERA_WIDE, 0, 0, 0, transition);
  }
}

/**
 * The per-frame heartbeat: derives sim time, runs the ephemeris, and writes
 * display transforms + real-space shader uniforms straight into the scene.
 * Reads the store via getState() — no subscription, no React re-renders.
 */
export function SimulationDriver() {
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  // Camera preset transitions (smooth), applied on every preset click (the
  // seq counter bumps even when re-clicking the active one, so "Earth" also
  // works as a recenter button) — and when a new eclipse is selected, so the
  // Moon view re-aims at the new event's geometry.
  useEffect(
    () =>
      useEclipseStore.subscribe((state, prev) => {
        const c = controlsRef.current;
        if (!c) return;
        const presetClicked = state.cameraPresetSeq !== prev.cameraPresetSeq;
        const eclipseChanged =
          state.selectedEclipseId !== prev.selectedEclipseId && state.selectedEclipseId !== null;
        if (!presetClicked && !(eclipseChanged && state.cameraPreset !== "earth")) return;
        if (state.cameraPreset === "earth") {
          aimEarthView(c, state.selectedEclipseId, true);
        } else if (state.cameraPreset === "eclipse") {
          aimEclipseLock(c, state.selectedEclipseId, true);
        } else if (state.cameraPreset === "moon") {
          const t = getSimTimeMs();
          const gs = computeGeoState(t);
          const e = activeEclipse(t, state.selectedEclipseId);
          _dir.copy(gs.moonKm).normalize();
          if (e?.type === "solar") {
            // During a solar eclipse the Moon's lit face points at the Sun,
            // away from Earth — so view from beyond the Moon on the sunward
            // side, looking back: lit Moon in the foreground, Earth with the
            // eclipse shadow behind it (~12 deg apart, both in frame).
            _perp.set(_dir.z, 0, -_dir.x).normalize();
            c.setLookAt(
              _dir.x * 12.3 + _perp.x * 1.3,
              _dir.y * 12.3 + 0.5,
              _dir.z * 12.3 + _perp.z * 1.3,
              _dir.x * MOON_DISPLAY_DIST,
              _dir.y * MOON_DISPLAY_DIST,
              _dir.z * MOON_DISPLAY_DIST,
              true,
            );
          } else {
            // Between Earth and Moon, looking at the Moon's near side —
            // during a lunar eclipse that's the face that turns red (the
            // far side is simply night). Slightly above the line so Earth
            // doesn't block.
            _dir.multiplyScalar(MOON_DISPLAY_DIST);
            c.setLookAt(_dir.x * 0.72, _dir.y * 0.72 + 1.0, _dir.z * 0.72, _dir.x, _dir.y, _dir.z, true);
          }
        }
      }),
    [],
  );

  // Initial aim: the store boots with the nearest eclipse selected, the sim
  // time inside its window, and the lock preset — frame it instantly (the
  // loading screen still covers the canvas at this point).
  const aimedRef = useRef(false);
  useEffect(() => {
    if (!controls || aimedRef.current) return;
    aimedRef.current = true;
    const state = useEclipseStore.getState();
    if (state.cameraPreset === "eclipse") aimEclipseLock(controls, state.selectedEclipseId, false);
    else if (state.cameraPreset === "earth") aimEarthView(controls, state.selectedEclipseId, false);
  }, [controls]);

  useFrame(() => {
    const { earthGroup, moonGroup, sunMesh, earthMaterial, moonMaterial } = sceneRefs;
    const state = useEclipseStore.getState();
    const t = getSimTimeMs();

    // Stop playback when it crosses the end of the eclipse window (only on
    // the crossing — playing from beyond the window stays free).
    if (state.basePerfMs !== null && _prevSimT < state.fineWindow.endMs && t >= state.fineWindow.endMs) {
      state.pause();
      state.setTime(state.fineWindow.endMs);
    }
    _prevSimT = t;

    const gs = computeGeoState(t);

    if (earthGroup) earthGroup.quaternion.copy(gs.earthQuat);
    if (moonGroup) {
      moonGroup.position.copy(_dir.copy(gs.moonKm).normalize().multiplyScalar(MOON_DISPLAY_DIST));
      moonGroup.quaternion.copy(gs.moonQuat);
    }
    if (sunMesh) {
      sunMesh.position.copy(_dir.copy(gs.sunKm).normalize().multiplyScalar(SUN_DISPLAY_DIST));
    }
    if (earthMaterial) {
      earthMaterial.uniforms.uSunPosKm.value.copy(gs.sunKm);
      earthMaterial.uniforms.uMoonPosKm.value.copy(gs.moonKm);
      earthMaterial.uniforms.uContours.value = state.showContours ? 1.0 : 0.0;
    }
    if (moonMaterial) {
      moonMaterial.uniforms.uSunPosKm.value.copy(gs.sunKm);
      moonMaterial.uniforms.uMoonPosKm.value.copy(gs.moonKm);
    }

    // Every preset pins its orbit target each frame (no transition): the
    // Moon/Sun drift as time scrubs, and Earth stays locked to the origin so
    // an interrupted preset flight can never leave the camera orbiting the
    // wrong body.
    const c = controlsRef.current;
    if (state.cameraPreset !== "eclipse") _prevLock.set(0, 0, 0);
    if (c && state.cameraPreset === "eclipse") {
      const e = activeEclipse(getSimTimeMs(), state.selectedEclipseId);
      if (!e) {
        // The eclipse window ended — pull back to the Earth view.
        _prevLock.set(0, 0, 0);
        state.setCameraPreset("earth");
      } else if (e.type === "lunar" && moonGroup) {
        _prevLock.set(0, 0, 0);
        pinTarget(c, moonGroup.position.x, moonGroup.position.y, moonGroup.position.z);
      } else {
        // Follow the sweeping shadow: rotate the camera around Earth by the
        // same rotation the shadow point makes each frame, so the "hovering
        // above the eclipse" relation survives the sweep (and the user's own
        // orbiting is preserved, just carried along). While the controls are
        // mid-flight or being dragged, follow with the target only so we
        // don't fight their damping; the threshold is ~4.5e-6 rad — far
        // below a pixel, so slow sweeps stay smooth.
        shadowLockDir(gs, _dir);
        if (!c.active && _prevLock.lengthSq() > 0 && _prevLock.dot(_dir) < 1 - 1e-11) {
          _lockQ.setFromUnitVectors(_prevLock, _dir);
          _camPos.copy(c.camera.position).applyQuaternion(_lockQ);
          c.setLookAt(_camPos.x, _camPos.y, _camPos.z, _dir.x, _dir.y, _dir.z, false);
        } else {
          pinTarget(c, _dir.x, _dir.y, _dir.z);
        }
        _prevLock.copy(_dir);
      }
    } else if (c && state.cameraPreset === "moon" && moonGroup) {
      pinTarget(c, moonGroup.position.x, moonGroup.position.y, moonGroup.position.z);
    } else if (c && state.cameraPreset === "earth") {
      pinTarget(c, 0, 0, 0);
    }

    // Altitude-proportional controls: dolly steps are multiplicative on the
    // distance to the target, so near the surface a single wheel tick would
    // eat most of the remaining altitude — and a small drag would fling the
    // view across continents. Scale both with altitude above the surface.
    // The eclipse lock targets a point ON the surface (distance-to-target IS
    // the altitude), so it also gets a lower minDistance for the same
    // closest approach as the Earth view (~0.3 above ground).
    if (c) {
      const d = c.camera.position.distanceTo(c.getTarget(_target));
      const surfaceTarget = state.cameraPreset === "eclipse";
      c.minDistance = surfaceTarget ? 0.3 : 1.3;
      const altitude = surfaceTarget ? d : d - 1;
      const proximity = MathUtils.clamp(altitude / (altitude + 1), 0.07, 1.0);
      c.dollySpeed = proximity;
      c.azimuthRotateSpeed = proximity;
      c.polarRotateSpeed = proximity;
    }
  });

  return null;
}
