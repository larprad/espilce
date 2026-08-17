import { Matrix4, Quaternion, Vector3 } from "three";
import type { AstroTime, AxisInfo, RotationMatrix, Vector } from "astronomy-engine";
import {
  KM_PER_AU,
  RotateVector,
  Rotation_EQD_EQJ,
  Rotation_EQJ_ECL,
  SiderealTime,
} from "astronomy-engine";

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

/**
 * EQJ direction (Vector3) -> scene axes, in place: rotate into the ecliptic
 * frame (same matrix/convention as RotateVector), then the Z-up -> Y-up
 * bridge. Skipping the ecliptic rotation here was the "no axial tilt" bug —
 * Earth's pole would land on the ecliptic pole and the terminator lost its
 * seasonal ±23.4°.
 */
function eqjDirToScene(v: Vector3): Vector3 {
  const r = EQJ_TO_ECL.rot;
  const x = r[0][0] * v.x + r[1][0] * v.y + r[2][0] * v.z;
  const y = r[0][1] * v.x + r[1][1] * v.y + r[2][1] * v.z;
  const z = r[0][2] * v.x + r[1][2] * v.y + r[2][2] * v.z;
  return v.set(x, z, -y);
}

// Scratch objects — this module is called every frame; avoid allocation.
const _pole = new Vector3();
const _node = new Vector3();
const _xb = new Vector3();
const _yb = new Vector3();
const _m = new Matrix4();

/** Apply an astronomy-engine RotationMatrix to a Vector3 in place
 *  (same index convention as RotateVector). */
function applyRot(rot: RotationMatrix, v: Vector3): Vector3 {
  const r = rot.rot;
  const x = r[0][0] * v.x + r[1][0] * v.y + r[2][0] * v.z;
  const y = r[0][1] * v.x + r[1][1] * v.y + r[2][1] * v.z;
  const z = r[0][2] * v.x + r[1][2] * v.y + r[2][2] * v.z;
  return v.set(x, y, z);
}

/** EQJ Vector3 -> scene axes, in place (ecliptic rotation + Z-up -> Y-up). */
function eqjV3ToScene(v: Vector3): Vector3 {
  applyRot(EQJ_TO_ECL, v);
  return v.set(v.x, v.z, -v.y);
}

/**
 * Earth orientation quaternion (body coords, Z = pole / X = prime meridian,
 * into scene coords), built from Greenwich apparent sidereal time and the
 * equator-of-date frame: in EQD the true pole is exactly z and geographic
 * longitude L sits at RA = GAST + L, so the prime meridian is the unit
 * vector at RA = GAST. This is exact for the whole 1950-2100 range.
 *
 * DO NOT use RotationAxis(Body.Earth) for this: the IAU node it measures the
 * spin angle from is the intersection of the equator-of-date with the J2000
 * equator, which is numerically DEGENERATE near the year 2000 — it produced
 * a 154 deg longitude error for the 1999-08-11 eclipse and a residual ~0.9
 * deg bias decades away.
 */
export function earthOrientation(time: AstroTime, out: Quaternion): Quaternion {
  const g = (SiderealTime(time) * 15 * Math.PI) / 180;
  const eqd2eqj = Rotation_EQD_EQJ(time);
  _xb.set(Math.cos(g), Math.sin(g), 0); // prime meridian in EQD
  _pole.set(0, 0, 1); // true pole of date in EQD
  eqjV3ToScene(applyRot(eqd2eqj, _xb));
  eqjV3ToScene(applyRot(eqd2eqj, _pole));
  _yb.crossVectors(_pole, _xb);
  _m.set(
    _xb.x, _yb.x, _pole.x, 0,
    _xb.y, _yb.y, _pole.y, 0,
    _xb.z, _yb.z, _pole.z, 0,
    0, 0, 0, 1,
  );
  return out.setFromRotationMatrix(_m);
}

/**
 * Quaternion orienting a body mesh from astronomy-engine's RotationAxis result.
 * MOON ONLY (includes physical libration): for Earth this parameterization is
 * degenerate near J2000 — use earthOrientation() above instead.
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

  // Body -> EQJ has columns [X_b, Y_b, P]. Re-express each column in scene
  // axes (ecliptic rotation + axis bridge), then assemble the matrix. The
  // mesh-level pole swap (SphereGeometry poles are +/-Y, body pole is +Z)
  // is the mesh calibration and lives with the mesh, not here.
  eqjDirToScene(_xb);
  eqjDirToScene(_yb);
  eqjDirToScene(_pole);
  _m.set(
    _xb.x, _yb.x, _pole.x, 0,
    _xb.y, _yb.y, _pole.y, 0,
    _xb.z, _yb.z, _pole.z, 0,
    0, 0, 0, 1,
  );
  return out.setFromRotationMatrix(_m);
}
