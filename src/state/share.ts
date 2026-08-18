import type CameraControls from "camera-controls";
import { Vector3 } from "three";
import { getEclipse } from "../astro/catalog";
import type { CameraPreset } from "./store";

/**
 * Share-link state, carried in the URL hash so it never reaches the server
 * (works on GitHub Pages, invisible to OG scrapers, orthogonal to `?nofx`).
 * Encoded as one opaque token: `#s=<base64url of "id|tMs|preset|cam|flags">`.
 * The pre-encoding readable form (`#e=…&t=…&v=…&c=…&o=…`) is still parsed
 * so older copied links keep working.
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

const b64encode = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64decode = (s: string): string | null => {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
};

interface RawFields {
  e?: string | null;
  t?: string | null;
  v?: string | null;
  c?: string | null;
  o?: string | null;
}

/** Every field validated independently — a corrupt value degrades to the
 *  normal boot default for that field instead of poisoning the whole link. */
function fromRaw(raw: RawFields): InitialShare | null {
  const out: InitialShare = {};

  if (raw.e && getEclipse(raw.e)) out.eclipseId = raw.e;

  const t = Number(raw.t);
  if (raw.t && Number.isFinite(t)) out.t = t;

  if (raw.v && PRESETS.has(raw.v)) out.preset = raw.v as CameraPreset;

  const c = raw.c?.split(",").map(Number);
  if (c?.length === 6 && c.every(Number.isFinite)) {
    out.cam = c as InitialShare["cam"];
  }

  if (raw.o != null) {
    out.lines = raw.o.includes("l");
    out.cities = raw.o.includes("c");
  }

  return Object.keys(out).length > 0 ? out : null;
}

function parseShareHash(hash: string): InitialShare | null {
  if (!hash.startsWith("#")) return null;
  const p = new URLSearchParams(hash.slice(1));
  const packed = p.get("s");
  if (packed !== null) {
    const decoded = b64decode(packed);
    if (decoded === null) return null;
    const [e, t, v, c, o] = decoded.split("|");
    return fromRaw({ e, t, v, c, o });
  }
  return fromRaw({ e: p.get("e"), t: p.get("t"), v: p.get("v"), c: p.get("c"), o: p.get("o") });
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
  const payload = [state.selectedEclipseId, Math.round(timeMs), state.cameraPreset, c, o].join("|");
  return `${location.origin}${location.pathname}#s=${b64encode(payload)}`;
}
