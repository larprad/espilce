import type { Vector3 } from "three";

/**
 * Geographic lat/lon (degrees, east-positive) -> unit direction in the
 * SphereGeometry mesh frame (poles on +/-Y, prime meridian on +X, texture
 * calibration handled by MESH_CALIBRATION_X on the parent). Same convention
 * the orientation calibration was verified against.
 */
export function latLonToMeshDir(latDeg: number, lonDeg: number, out: Vector3): Vector3 {
  const phi = ((lonDeg + 180) / 360) * 2 * Math.PI;
  const theta = ((90 - latDeg) * Math.PI) / 180;
  return out.set(
    -Math.cos(phi) * Math.sin(theta),
    Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
  );
}
