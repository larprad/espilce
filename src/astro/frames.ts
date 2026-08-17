import { Matrix4, Quaternion, Vector3 } from "three";
import type { AxisInfo, RotationMatrix, Vector } from "astronomy-engine";
import { KM_PER_AU, RotateVector, Rotation_EQJ_ECL } from "astronomy-engine";

/**
 * Frame conventions.
 *
 * astronomy-engine vectors are right-handed Z-up (equatorial or ecliptic J2000).
 * The scene uses three.js right-handed Y-up, with the ecliptic as the XZ plane
 * and +Y = ecliptic north. The bridge (x, y, z) -> (x, z, -y) is a proper
 * rotation, so handedness (and therefore all angles) is preserved.
 */

const EQJ_TO_ECL: RotationMatrix = Rotation_EQJ_ECL();

/** astronomy-engine EQJ vector (AU) -> scene axes, km. Writes into `out`. */
export function eqjToSceneKm(vec: Vector, out: Vector3): Vector3 {
  const e = RotateVector(EQJ_TO_ECL, vec);
  return out.set(e.x, e.z, -e.y).multiplyScalar(KM_PER_AU);
}

// Scratch objects — this module is called every frame; avoid allocation.
const _pole = new Vector3();
const _node = new Vector3();
const _xb = new Vector3();
const _yb = new Vector3();
const _m = new Matrix4();

/**
 * Quaternion orienting a body mesh from astronomy-engine's RotationAxis result.
 *
 * IAU convention: pole = `axis.north` (EQJ), prime meridian at angle W
 * (`axis.spin`, degrees) from the node Q = z_EQJ x pole. We build the body
 * frame in EQJ (columns [X_b, P x X_b, P]), then re-express in scene axes.
 * The mesh itself must map its texture so the body +Z is the north pole and
 * +X the prime meridian (see CALIBRATION quaternions in the scene layer).
 */
export function quatFromAxisInfo(axis: AxisInfo, out: Quaternion): Quaternion {
  _pole.set(axis.north.x, axis.north.y, axis.north.z); // EQJ, Z-up

  // Node: z_EQJ x pole. Degenerate only if the pole sits on z_EQJ exactly;
  // Earth is ~0.4 arcmin off over our range, never truly degenerate enough
  // to matter, but guard anyway.
  _node.set(-_pole.y, _pole.x, 0);
  if (_node.lengthSq() < 1e-12) _node.set(1, 0, 0);
  _node.normalize();

  const w = (axis.spin * Math.PI) / 180;
  // X_b = Q cos W + (P x Q) sin W  (Rodrigues rotation of Q about P)
  _xb.crossVectors(_pole, _node).multiplyScalar(Math.sin(w)).addScaledVector(_node, Math.cos(w));
  _yb.crossVectors(_pole, _xb);

  // Body -> EQJ has columns [X_b, Y_b, P]. Convert each column from EQJ
  // Z-up to scene Y-up via (x, y, z) -> (x, z, -y), then also swap which
  // body axis is "up" for the mesh: three.js SphereGeometry poles are +/-Y,
  // so we want body +Z (pole) to land on mesh +Y. That second swap is the
  // mesh calibration and lives with the mesh, not here — this quaternion
  // maps body coordinates (Z = pole) to scene coordinates.
  _m.set(
    _xb.x, _yb.x, _pole.x, 0,
    _xb.z, _yb.z, _pole.z, 0,
    -_xb.y, -_yb.y, -_pole.y, 0,
    0, 0, 0, 1,
  );
  return out.setFromRotationMatrix(_m);
}
