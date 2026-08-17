import type { Group, Mesh, ShaderMaterial } from "three";

/**
 * Mutable registry connecting scene components to the SimulationDriver.
 * Components register their objects on mount; the driver mutates transforms
 * and uniforms directly every frame, so React never re-renders during playback.
 */
export const sceneRefs = {
  earthGroup: null as Group | null,
  moonGroup: null as Group | null,
  sunMesh: null as Mesh | null,
  earthMaterial: null as ShaderMaterial | null,
  moonMaterial: null as ShaderMaterial | null,
};
