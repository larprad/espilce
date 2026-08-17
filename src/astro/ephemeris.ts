import { Quaternion, Vector3 } from "three";
import { Body, GeoMoon, GeoVector, MakeTime, RotationAxis } from "astronomy-engine";
import { eqjToSceneKm, quatFromAxisInfo } from "./frames";
import type { GeoState } from "./types";

const _state: GeoState = {
  sunKm: new Vector3(),
  moonKm: new Vector3(),
  earthQuat: new Quaternion(),
  moonQuat: new Quaternion(),
};

/**
 * Real-space geometry at `timeMs`: geocentric Sun/Moon in km (scene axes)
 * plus Earth/Moon orientation quaternions. Costs well under 1 ms — safe to
 * call every frame. Returns a shared mutable object; consumers must copy
 * values out (into mesh transforms / shader uniforms), never hold it.
 */
export function computeGeoState(timeMs: number): GeoState {
  const t = MakeTime(new Date(timeMs));
  eqjToSceneKm(GeoVector(Body.Sun, t, true), _state.sunKm);
  eqjToSceneKm(GeoMoon(t), _state.moonKm);
  quatFromAxisInfo(RotationAxis(Body.Earth, t), _state.earthQuat);
  quatFromAxisInfo(RotationAxis(Body.Moon, t), _state.moonQuat);
  return _state;
}
