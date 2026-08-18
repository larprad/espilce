import { create } from "zustand";
import { getEclipse, nearestEclipse, nextEclipse, prevEclipse } from "../astro/catalog";
import { MAX_TIME_MS, MIN_TIME_MS, type EclipseType } from "../astro/types";

export const SPEEDS = [1, 60, 600, 3600, 21600, 86400] as const;
export type Speed = (typeof SPEEDS)[number];

export type CameraPreset = "eclipse" | "earth" | "moon";

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

  /** An eclipse is ALWAYS selected (initialized to the one nearest "now"). */
  selectedEclipseId: string;
  fineWindow: FineWindow;
  cameraPreset: CameraPreset;
  /** Bumped on every setCameraPreset call, so re-clicking the active preset re-aims. */
  cameraPresetSeq: number;
  /** Obscuration overlay: iso-lines at 100/75/50/25% Sun coverage. */
  showContours: boolean;
  /** City dots + labels when zoomed in. */
  showCities: boolean;
  catalogOpen: boolean;
  /** Timezone used for every human-facing time (input included). */
  timeDisplay: "local" | "utc";
  /** True once the Suspense boundary (textures) has resolved. */
  sceneReady: boolean;

  setTime(ms: number): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  /** Rewind to the start of the selected eclipse's window and play it. */
  replayEclipse(): void;
  setSpeed(s: Speed): void;
  selectEclipse(id: string): void;
  jumpToNext(type?: EclipseType): void;
  jumpToPrev(type?: EclipseType): void;
  setCameraPreset(p: CameraPreset): void;
  setShowContours(on: boolean): void;
  setShowCities(on: boolean): void;
  setCatalogOpen(open: boolean): void;
  setTimeDisplay(mode: "local" | "utc"): void;
  setSceneReady(): void;
}

const clampTime = (ms: number) => Math.min(MAX_TIME_MS, Math.max(MIN_TIME_MS, ms));

export function simTimeOf(s: Pick<EclipseStore, "baseSimMs" | "basePerfMs" | "speed">): number {
  if (s.basePerfMs === null) return s.baseSimMs;
  return clampTime(s.baseSimMs + (performance.now() - s.basePerfMs) * s.speed);
}

function fineWindowFor(id: string): FineWindow {
  const e = getEclipse(id)!;
  const halfMs =
    e.type === "solar"
      ? 4 * 3600_000
      : Math.max(6 * 3600_000, 2 * (e.sdPenumMin ?? 0) * 60_000);
  return { startMs: e.peakMs - halfMs, endMs: e.peakMs + halfMs };
}

const initialEclipse = nearestEclipse(clampTime(Date.now()));

export const useEclipseStore = create<EclipseStore>((set, get) => ({
  // Boot inside the nearest eclipse's window, paused 45 min before peak —
  // same landing as selecting it — so the app opens on something to see
  // (the camera counterpart is the initial Earth-view aim in the driver).
  baseSimMs: clampTime(initialEclipse.peakMs - 45 * 60_000),
  basePerfMs: null,
  speed: 600,

  selectedEclipseId: initialEclipse.id,
  fineWindow: fineWindowFor(initialEclipse.id),
  cameraPreset: "earth",
  cameraPresetSeq: 0,
  showContours: true,
  showCities: false,
  catalogOpen: false,
  timeDisplay: "local",
  sceneReady: false,

  setTime: (ms) =>
    set((s) => ({
      baseSimMs: clampTime(ms),
      basePerfMs: s.basePerfMs === null ? null : performance.now(),
    })),

  play: () => set({ baseSimMs: simTimeOf(get()), basePerfMs: performance.now() }),
  pause: () => set({ baseSimMs: simTimeOf(get()), basePerfMs: null }),
  togglePlay: () => (get().basePerfMs === null ? get().play() : get().pause()),

  replayEclipse: () =>
    set((s) => ({
      baseSimMs: s.fineWindow.startMs,
      basePerfMs: performance.now(),
      speed: 600 as Speed,
    })),

  // Re-anchor so changing speed never jumps the current instant.
  setSpeed: (speed) =>
    set((s) => ({
      speed,
      baseSimMs: simTimeOf(s),
      basePerfMs: s.basePerfMs === null ? null : performance.now(),
    })),

  selectEclipse: (id) => {
    const e = getEclipse(id);
    if (!e) return;
    set((s) => ({
      selectedEclipseId: id,
      fineWindow: fineWindowFor(id),
      baseSimMs: clampTime(e.peakMs - 45 * 60_000),
      basePerfMs: null, // land paused, ready to scrub or play
      speed: 600,
      // Always show the phenomenon itself: the eclipse camera lock presents
      // solar events as the shadow on Earth and lunar ones as the red Moon.
      // The seq bump forces a re-aim even if the lock was already active.
      cameraPreset: "eclipse" as const,
      cameraPresetSeq: s.cameraPresetSeq + 1,
    }));
  },

  // Step relative to the selected eclipse's peak only while the sim time is
  // inside its window (selection lands at peak - 45 min, so stepping from the
  // sim time there would re-find the same event). If the user scrubbed far
  // away, step from the sim time — the arrows move relative to where the
  // user is looking.
  jumpToNext: (type) => {
    const s = get();
    const t = simTimeOf(s);
    const within = t >= s.fineWindow.startMs && t <= s.fineWindow.endMs;
    const fromMs = within ? Math.max(getEclipse(s.selectedEclipseId)!.peakMs, t) : t;
    const e = nextEclipse(fromMs + 1000, type);
    if (e) s.selectEclipse(e.id);
  },
  jumpToPrev: (type) => {
    const s = get();
    const t = simTimeOf(s);
    const within = t >= s.fineWindow.startMs && t <= s.fineWindow.endMs;
    const fromMs = within ? Math.min(getEclipse(s.selectedEclipseId)!.peakMs, t) : t;
    const e = prevEclipse(fromMs - 1000, type);
    if (e) s.selectEclipse(e.id);
  },

  setCameraPreset: (cameraPreset) =>
    set((s) => ({ cameraPreset, cameraPresetSeq: s.cameraPresetSeq + 1 })),
  setShowContours: (showContours) => set({ showContours }),
  setShowCities: (showCities) => set({ showCities }),
  setCatalogOpen: (catalogOpen) => set({ catalogOpen }),
  setTimeDisplay: (timeDisplay) => set({ timeDisplay }),
  setSceneReady: () => set({ sceneReady: true }),
}));

/** Current sim time — for use outside React render (useFrame, event handlers). */
export const getSimTimeMs = () => simTimeOf(useEclipseStore.getState());
