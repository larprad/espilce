import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Frustum,
  Group,
  type Material,
  MathUtils,
  Matrix4,
  PointsMaterial,
  Quaternion,
  Vector3,
} from "three";
import { Text } from "troika-three-text";
import rawCities from "../data/cities.json";
import { useEclipseStore } from "../state/store";
import { latLonToMeshDir } from "./geo";

/** [asciiName, lat, lon, population], sorted by population desc. */
const CITIES = rawCities as Array<[string, number, number, number]>;

const LABEL_POOL = 40;
const DOT_RADIUS = 1.002;
const LABEL_RADIUS = 1.004;
const LABEL_MAX_CAM_DIST = 3.0;
const REFRESH_INTERVAL = 0.3;
const FADE_RATE = 6; // opacity units per second

interface Slot {
  text: Text;
  cityIdx: number; // -1 = free
  targetOpacity: number;
  opacity: number;
}

const _v = new Vector3();
const _p = new Vector3();
const _camN = new Vector3();
const _m4 = new Matrix4();
const _qInv = new Quaternion();
const _frustum = new Frustum();
const _pickedDirs = Array.from({ length: LABEL_POOL }, () => new Vector3());

/**
 * Zoom-in city layer: 12k dots that rotate with the planet (this component
 * must sit inside Earth's calibrated frame), plus a pool of 40 troika text
 * labels in world space. Labels keep a stable city->slot assignment across
 * refreshes and fade in/out instead of popping. Everything is driven
 * imperatively from useFrame — no re-renders.
 */
export function CityLayer() {
  const frameRef = useRef<Group>(null);
  const lastRefresh = useRef(-1);

  const { geometry, dirs } = useMemo(() => {
    const n = CITIES.length;
    const dirs = new Float32Array(n * 3);
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      latLonToMeshDir(CITIES[i][1], CITIES[i][2], _v);
      dirs[i * 3] = _v.x;
      dirs[i * 3 + 1] = _v.y;
      dirs[i * 3 + 2] = _v.z;
      positions[i * 3] = _v.x * DOT_RADIUS;
      positions[i * 3 + 1] = _v.y * DOT_RADIUS;
      positions[i * 3 + 2] = _v.z * DOT_RADIUS;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return { geometry, dirs };
  }, []);

  const material = useMemo(() => {
    // Soft round sprite — square GL_POINTS look harsh against the texture.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new PointsMaterial({
      size: 4,
      sizeAttenuation: false,
      map: new CanvasTexture(canvas),
      color: "#dfe7f5",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  }, []);

  // Label pool, created once, parented to the rotating Earth frame so labels
  // track the planet every frame (world-space parenting made them snap only
  // on the 0.3 s refresh — visible stutter during playback).
  const slotsRef = useRef<Slot[]>([]);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const slots: Slot[] = [];
    for (let i = 0; i < LABEL_POOL; i++) {
      const t = new Text();
      t.font = "/fonts/Roboto-Regular.woff";
      t.fontSize = 0.01;
      t.color = "#dde4ef";
      t.outlineColor = "#05070d";
      t.outlineWidth = "8%";
      t.anchorX = "center";
      t.anchorY = "bottom";
      t.visible = false;
      t.renderOrder = 10;
      // Our horizon culling decides visibility; depth-testing the billboarded
      // text plane against the sphere is what caused labels to clip into it.
      (t.material as Material).depthTest = false;
      frame.add(t);
      slots.push({ text: t, cityIdx: -1, targetOpacity: 0, opacity: 0 });
    }
    slotsRef.current = slots;
    return () => {
      for (const s of slots) {
        frame.remove(s.text);
        s.text.dispose();
      }
      slotsRef.current = [];
    };
  }, []);

  useFrame(({ camera, clock }, delta) => {
    const show = useEclipseStore.getState().showCities;
    const camDist = camera.position.length();

    material.opacity = show ? MathUtils.clamp(((4 - camDist) / 1.5) * 0.5, 0, 0.5) : 0;

    const slots = slotsRef.current;
    // Whole-layer fade around the labels-on threshold.
    const layerFade = show ? MathUtils.clamp((LABEL_MAX_CAM_DIST - camDist) / 0.4, 0, 1) : 0;

    // Per-frame: billboard + opacity animation (cheap, 40 items). Labels are
    // children of the rotating Earth frame, so screen-facing orientation is
    // localQ = parentWorldQ^-1 * cameraWorldQ.
    if (frameRef.current) frameRef.current.getWorldQuaternion(_qInv).invert();
    const fadeStep = FADE_RATE * Math.min(delta, 0.1);
    for (const s of slots) {
      if (s.cityIdx === -1 && s.opacity === 0) continue;
      s.opacity = MathUtils.clamp(
        s.opacity + Math.sign(s.targetOpacity - s.opacity) * fadeStep,
        Math.min(s.opacity, s.targetOpacity),
        Math.max(s.opacity, s.targetOpacity),
      );
      const finalOpacity = s.opacity * layerFade;
      s.text.visible = finalOpacity > 0.01;
      if (s.text.visible) {
        s.text.fillOpacity = finalOpacity * 0.88;
        s.text.outlineOpacity = finalOpacity * 0.6;
        s.text.quaternion.copy(_qInv).multiply(camera.quaternion);
      }
      if (s.opacity === 0 && s.targetOpacity === 0) s.cityIdx = -1; // fully faded -> free
    }

    if (layerFade === 0 || !frameRef.current) {
      for (const s of slots) s.targetOpacity = 0;
      return;
    }

    const now = clock.elapsedTime;
    if (now - lastRefresh.current < REFRESH_INTERVAL) return;
    lastRefresh.current = now;

    const m = frameRef.current.matrixWorld; // pure rotation (earth quat x calibration)
    _camN.copy(camera.position).normalize();
    // A unit-sphere surface point is beyond the horizon when cos(angle to the
    // camera direction) drops below 1/d; extra margin culls limb-floaters.
    const horizonCos = 1 / camDist + 0.02;
    _frustum.setFromProjectionMatrix(
      _m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const sepCos = Math.cos(MathUtils.clamp(0.055 * (camDist - 1), 0.004, 0.12));

    const visibleAt = (i: number): boolean => {
      _v.set(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2]).applyMatrix4(m);
      if (_v.dot(_camN) < horizonCos) return false;
      _p.copy(_v).multiplyScalar(LABEL_RADIUS);
      return _frustum.containsPoint(_p);
    };
    const placeSlot = (s: Slot, picked: number) => {
      _pickedDirs[picked].copy(_v);
      const fs = camera.position.distanceTo(_p) * 0.008;
      // Quantize in ~8% steps so continuous zoom rarely re-layouts the text.
      const fontSize = Math.pow(1.08, Math.round(Math.log(fs) / Math.log(1.08)));
      const name = CITIES[s.cityIdx][0];
      if (s.text.text !== name || s.text.fontSize !== fontSize) {
        s.text.text = name;
        s.text.fontSize = fontSize;
        s.text.sync();
      }
      // Earth-fixed position (local to the rotating frame) — rotates with
      // the planet every frame instead of snapping on refresh.
      const i = s.cityIdx;
      s.text.position
        .set(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2])
        .multiplyScalar(LABEL_RADIUS);
      s.targetOpacity = 1;
    };

    let picked = 0;
    const activeByCity = new Map<number, Slot>();
    // Pass 1 — keep currently-active labels that are still visible (set
    // stability beats strict greedy optimality; prevents flicker).
    for (const s of slots) {
      if (s.cityIdx === -1 || s.targetOpacity === 0) continue;
      if (picked < LABEL_POOL && visibleAt(s.cityIdx)) {
        placeSlot(s, picked++);
        activeByCity.set(s.cityIdx, s);
      } else {
        s.targetOpacity = 0;
      }
    }
    // Pass 2 — fill remaining slots with the most populous visible cities
    // that keep their angular distance from everything already picked.
    for (let i = 0; i < CITIES.length && picked < LABEL_POOL; i++) {
      if (activeByCity.has(i)) continue;
      if (!visibleAt(i)) continue;
      let crowded = false;
      for (let j = 0; j < picked; j++) {
        if (_v.dot(_pickedDirs[j]) > sepCos) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      const free = slots.find((s) => s.cityIdx === -1);
      if (!free) break;
      free.cityIdx = i;
      free.opacity = 0;
      placeSlot(free, picked++);
    }
  });

  return (
    <group ref={frameRef}>
      <points geometry={geometry} material={material} />
    </group>
  );
}
