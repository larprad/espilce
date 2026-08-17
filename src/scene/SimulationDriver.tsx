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

  // Camera preset transitions (smooth), applied on change only.
  useEffect(
    () =>
      useEclipseStore.subscribe((state, prev) => {
        const c = controlsRef.current;
        if (!c || state.cameraPreset === prev.cameraPreset) return;
        const t = getSimTimeMs();
        const gs = computeGeoState(t);
        if (state.cameraPreset === "wide") {
          c.setLookAt(...CAMERA_WIDE, 0, 0, 0, true);
        } else if (state.cameraPreset === "sunline") {
          // Just off the Sun–Earth axis, sunward side, looking back at Earth.
          // Keep the offset small: it reads as parallax between the Moon
          // (10 units out) and Earth, so a large one flings the Moon aside.
          _dir.copy(gs.sunKm).normalize().multiplyScalar(16);
          c.setLookAt(_dir.x + 0.6, _dir.y + 1.1, _dir.z, 0, 0, 0, true);
        } else {
          // Between Earth and Moon, looking at the Moon's near side — during
          // a lunar eclipse that's the face that turns red (the far side is
          // simply night). Slightly above the line so Earth doesn't block.
          _dir.copy(gs.moonKm).normalize().multiplyScalar(MOON_DISPLAY_DIST);
          c.setLookAt(_dir.x * 0.55, _dir.y * 0.55 + 1.4, _dir.z * 0.55, _dir.x, _dir.y, _dir.z, true);
        }
      }),
    [],
  );

  useFrame(() => {
    const { earthGroup, moonGroup, sunMesh, earthMaterial, moonMaterial } = sceneRefs;
    const state = useEclipseStore.getState();
    const gs = computeGeoState(getSimTimeMs());
    const boost = state.shadowBoost ? 0.35 : 1.0;

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
      earthMaterial.uniforms.uShadowBoost.value = boost;
    }
    if (moonMaterial) {
      moonMaterial.uniforms.uSunPosKm.value.copy(gs.sunKm);
      moonMaterial.uniforms.uMoonPosKm.value.copy(gs.moonKm);
      moonMaterial.uniforms.uShadowBoost.value = boost;
    }

    // Follow the Moon: keep the orbit target glued to it (no transition).
    const c = controlsRef.current;
    if (c && state.cameraPreset === "moon" && moonGroup) {
      c.setTarget(moonGroup.position.x, moonGroup.position.y, moonGroup.position.z, false);
    }
  });

  return null;
}
