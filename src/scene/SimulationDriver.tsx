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
const _target = new Vector3();
const _axis = new Vector3();
const _prevLock = new Vector3(); // zero-length = lock not engaged
const _lockQ = new Quaternion();
const _camPos = new Vector3();

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
          c.setLookAt(...CAMERA_WIDE, 0, 0, 0, true);
        } else if (state.cameraPreset === "eclipse") {
          // Lock on the ongoing eclipse: hover over the shadow's maximum
          // point for solar; the Moon's near side for lunar.
          const t = getSimTimeMs();
          const gs = computeGeoState(t);
          const e = activeEclipse(t, state.selectedEclipseId);
          if (e?.type === "lunar") {
            _dir.copy(gs.moonKm).normalize().multiplyScalar(MOON_DISPLAY_DIST);
            c.setLookAt(_dir.x * 0.55, _dir.y * 0.55 + 1.4, _dir.z * 0.55, _dir.x, _dir.y, _dir.z, true);
          } else {
            shadowLockDir(gs, _dir);
            c.setLookAt(_dir.x * 2.6, _dir.y * 2.6, _dir.z * 2.6, _dir.x, _dir.y, _dir.z, true);
          }
        } else if (state.cameraPreset === "moon") {
          // Between Earth and Moon, looking at the Moon's near side — during
          // a lunar eclipse that's the face that turns red (the far side is
          // simply night). Slightly above the line so Earth doesn't block.
          const gs = computeGeoState(getSimTimeMs());
          _dir.copy(gs.moonKm).normalize().multiplyScalar(MOON_DISPLAY_DIST);
          c.setLookAt(_dir.x * 0.55, _dir.y * 0.55 + 1.4, _dir.z * 0.55, _dir.x, _dir.y, _dir.z, true);
        } else {
          // On the Earth–Sun line, 8 units sunward, looking at the Sun. The
          // Moon orbits at 10 display units, so during a solar eclipse its
          // dark disc (~2 units ahead) covers the Sun like the real thing.
          const gs = computeGeoState(getSimTimeMs());
          _dir.copy(gs.sunKm).normalize();
          c.setLookAt(
            _dir.x * 8, _dir.y * 8 + 0.15, _dir.z * 8,
            _dir.x * SUN_DISPLAY_DIST, _dir.y * SUN_DISPLAY_DIST, _dir.z * SUN_DISPLAY_DIST,
            true,
          );
        }
      }),
    [],
  );

  useFrame(() => {
    const { earthGroup, moonGroup, sunMesh, earthMaterial, moonMaterial } = sceneRefs;
    const state = useEclipseStore.getState();
    const gs = computeGeoState(getSimTimeMs());

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
        c.setTarget(moonGroup.position.x, moonGroup.position.y, moonGroup.position.z, false);
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
          c.setTarget(_dir.x, _dir.y, _dir.z, false);
        }
        _prevLock.copy(_dir);
      }
    } else if (c && state.cameraPreset === "moon" && moonGroup) {
      c.setTarget(moonGroup.position.x, moonGroup.position.y, moonGroup.position.z, false);
    } else if (c && state.cameraPreset === "sun" && sunMesh) {
      c.setTarget(sunMesh.position.x, sunMesh.position.y, sunMesh.position.z, false);
    } else if (c && state.cameraPreset === "earth") {
      c.setTarget(0, 0, 0, false);
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
