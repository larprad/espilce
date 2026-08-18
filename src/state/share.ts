import type CameraControls from "camera-controls";
import { Vector3 } from "three";
import { getEclipse } from "../astro/catalog";
import type { CameraPreset } from "./store";

/**
 * Share-link state, carried in the URL hash so it never reaches the server
 * (works on GitHub Pages, invisible to OG scrapers, orthogonal to `?nofx`):
 * `#e=<eclipseId>&t=<simMs>&v=<preset>&c=px,py,pz,tx,ty,tz&o=[l][c]`
 */
export interface InitialShare {
  eclipseId?: string;
  t?: number;
  preset?: CameraPreset;
  cam?: [number, number, number, number, number, number];
  lines?: boolean;
  cities?: boolean;
}

const PRESETS: ReadonlySet<string> = new Set(["eclipse", "earth", "moon"]);

/** Every field validated independently — a corrupt param degrades to the
 *  normal boot default for that field instead of poisoning the whole link. */
function parseShareHash(hash: string): InitialShare | null {
  if (!hash.startsWith("#")) return null;
  const p = new URLSearchParams(hash.slice(1));
  const out: InitialShare = {};

  const e = p.get("e");
  if (e && getEclipse(e)) out.eclipseId = e;

  const tRaw = p.get("t");
  const t = Number(tRaw);
  if (tRaw && Number.isFinite(t)) out.t = t;

  const v = p.get("v");
  if (v && PRESETS.has(v)) out.preset = v as CameraPreset;

  const c = p.get("c")?.split(",").map(Number);
  if (c?.length === 6 && c.every(Number.isFinite)) {
    out.cam = c as InitialShare["cam"];
  }

  const o = p.get("o");
  if (o !== null) {
    out.lines = o.includes("l");
    out.cities = o.includes("c");
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** Parsed once at boot; the store initializer and the driver's mount aim
 *  both consume it. */
export const initialShare = parseShareHash(window.location.hash);

const _pos = new Vector3();
const _tgt = new Vector3();
const f = (n: number) => Number(n.toFixed(4)); // ~0.6 km — plenty for a view

export function buildShareUrl(
  state: {
    selectedEclipseId: string;
    cameraPreset: CameraPreset;
    showContours: boolean;
    showCities: boolean;
  },
  timeMs: number,
  controls: CameraControls,
): string {
  controls.getPosition(_pos);
  controls.getTarget(_tgt);
  const c = [_pos.x, _pos.y, _pos.z, _tgt.x, _tgt.y, _tgt.z].map(f).join(",");
  const o = `${state.showContours ? "l" : ""}${state.showCities ? "c" : ""}`;
  return (
    `${location.origin}${location.pathname}` +
    `#e=${state.selectedEclipseId}&t=${Math.round(timeMs)}&v=${state.cameraPreset}&c=${c}&o=${o}`
  );
}
