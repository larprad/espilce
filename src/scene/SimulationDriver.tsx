import { useFrame, useThree } from "@react-three/fiber";
import type CameraControls from "camera-controls";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { computeGeoState } from "../astro/ephemeris";
import { getSimTimeMs, useEclipseStore } from "../state/store";
import { CAMERA_WIDE, MOON_DISPLAY_DIST, SUN_DISPLAY_DIST } from "./scale";
import { sceneRefs } from "./sceneRefs";

const _dir = new Vector3();

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

    // Follow the targeted body: keep the orbit target glued to it (no
    // transition) — both drift as time scrubs.
    const c = controlsRef.current;
    if (c && state.cameraPreset === "moon" && moonGroup) {
      c.setTarget(moonGroup.position.x, moonGroup.position.y, moonGroup.position.z, false);
    } else if (c && state.cameraPreset === "sun" && sunMesh) {
      c.setTarget(sunMesh.position.x, sunMesh.position.y, sunMesh.position.z, false);
    }
  });

  return null;
}
