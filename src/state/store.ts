import { create } from "zustand";
import { getEclipse, nextEclipse, prevEclipse } from "../astro/catalog";
import { MAX_TIME_MS, MIN_TIME_MS, type EclipseType } from "../astro/types";

export const SPEEDS = [1, 60, 600, 3600, 21600, 86400] as const;
export type Speed = (typeof SPEEDS)[number];

export type CameraPreset = "wide" | "sunline" | "moon";

interface FineWindow {
  startMs: number;
  endMs: number;
}

interface EclipseStore {
  /**
   * Derived-time model: simTime = baseSimMs + (performance.now() - basePerfMs) * speed.
   * basePerfMs === null means paused. Playback therefore writes NOTHING to the
   * store — the scene derives time inside useFrame, the UI polls at a few Hz.
   */
  baseSimMs: number;
  basePerfMs: number | null;
  speed: Speed;

  selectedEclipseId: string | null;
  fineWindow: FineWindow | null;
  cameraPreset: CameraPreset;
  shadowBoost: boolean;
  catalogOpen: boolean;
  /** Timezone used for every human-facing time (input included). */
  timeDisplay: "local" | "utc";

  setTime(ms: number): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  setSpeed(s: Speed): void;
  selectEclipse(id: string | null): void;
  jumpToNext(type?: EclipseType): void;
  jumpToPrev(type?: EclipseType): void;
  setCameraPreset(p: CameraPreset): void;
  setShadowBoost(on: boolean): void;
  setCatalogOpen(open: boolean): void;
  setTimeDisplay(mode: "local" | "utc"): void;
}

const clampTime = (ms: number) => Math.min(MAX_TIME_MS, Math.max(MIN_TIME_MS, ms));

export function simTimeOf(s: Pick<EclipseStore, "baseSimMs" | "basePerfMs" | "speed">): number {
  if (s.basePerfMs === null) return s.baseSimMs;
  return clampTime(s.baseSimMs + (performance.now() - s.basePerfMs) * s.speed);
}

function fineWindowFor(id: string): FineWindow | null {
  const e = getEclipse(id);
  if (!e) return null;
  const halfMs =
    e.type === "solar"
      ? 4 * 3600_000
      : Math.max(6 * 3600_000, 2 * (e.sdPenumMin ?? 0) * 60_000);
  return { startMs: e.peakMs - halfMs, endMs: e.peakMs + halfMs };
}

export const useEclipseStore = create<EclipseStore>((set, get) => ({
  baseSimMs: clampTime(Date.now()),
  basePerfMs: null,
  speed: 3600,

  selectedEclipseId: null,
  fineWindow: null,
  cameraPreset: "wide",
  shadowBoost: false,
  catalogOpen: false,
  timeDisplay: "local",

  setTime: (ms) =>
    set((s) => ({
      baseSimMs: clampTime(ms),
      basePerfMs: s.basePerfMs === null ? null : performance.now(),
    })),

  play: () => set({ baseSimMs: simTimeOf(get()), basePerfMs: performance.now() }),
  pause: () => set({ baseSimMs: simTimeOf(get()), basePerfMs: null }),
  togglePlay: () => (get().basePerfMs === null ? get().play() : get().pause()),

  // Re-anchor so changing speed never jumps the current instant.
  setSpeed: (speed) =>
    set((s) => ({
      speed,
      baseSimMs: simTimeOf(s),
      basePerfMs: s.basePerfMs === null ? null : performance.now(),
    })),

  selectEclipse: (id) => {
    if (id === null) {
      set({ selectedEclipseId: null, fineWindow: null });
      return;
    }
    const e = getEclipse(id);
    if (!e) return;
    set({
      selectedEclipseId: id,
      fineWindow: fineWindowFor(id),
      baseSimMs: clampTime(e.peakMs - 45 * 60_000),
      basePerfMs: null, // land paused, ready to scrub or play
      speed: 600,
    });
  },

  jumpToNext: (type) => {
    const e = nextEclipse(simTimeOf(get()) + 1000, type);
    if (e) get().selectEclipse(e.id);
  },
  jumpToPrev: (type) => {
    // Step from 46 min before "now" so repeated clicks walk backwards even
    // though selectEclipse lands at peak - 45 min.
    const e = prevEclipse(simTimeOf(get()) - 46 * 60_000, type);
    if (e) get().selectEclipse(e.id);
  },

  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setShadowBoost: (shadowBoost) => set({ shadowBoost }),
  setCatalogOpen: (catalogOpen) => set({ catalogOpen }),
  setTimeDisplay: (timeDisplay) => set({ timeDisplay }),
}));

/** Current sim time — for use outside React render (useFrame, event handlers). */
export const getSimTimeMs = () => simTimeOf(useEclipseStore.getState());
