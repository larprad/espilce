import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { activeEclipse, getEclipse } from "../astro/catalog";
import { localSolarCircumstances } from "../astro/localEclipse";
import { sceneRefs } from "../scene/sceneRefs";
import { buildShareUrl } from "../state/share";
import { type CameraPreset, getSimTimeMs, useEclipseStore } from "../state/store";
import { useSimTime } from "../state/useSimTime";
import { eclipseTitle, fmtDateTime, fmtDurationMin, fmtDurationSec, fmtLatLon } from "./format";
import { CatalogPanel } from "./CatalogPanel";
import { EclipseStatus } from "./EclipseStatus";
import { PickerHint } from "./PickerHint";
import { TimeControls } from "./TimeControls";

const PRESETS: Array<[CameraPreset, string, string]> = [
  ["earth", "Earth", "Center on Earth (click again to recenter)"],
  ["moon", "Moon", "Follow the Moon"],
];

/* SVG chevrons — text glyphs sit on the font baseline and never center. */
const ChevronLeft = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 3 5 8l5 5" />
  </svg>
);
const ChevronRight = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 3l5 5-5 5" />
  </svg>
);

/* The social-media "share" curved arrow (forward arrow with a swooping tail). */
const ShareIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.8 3.4 14.2 7.9 9.8 12.4v-2.7C6.2 9.7 3.9 11.1 2.1 13.9c.4-4.8 3-7.6 7.7-8z" />
  </svg>
);
const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
);

/** Copies a link reproducing the current view: eclipse, time, camera,
 *  overlays — all in the URL hash (parsed at boot in share.ts). */
function ShareButton() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return (
    <>
      <button
        className={`btn btn--icon btn--share ${copied ? "is-active" : ""}`}
        title="Copy a link to this exact view"
        onClick={() => {
          const controls = sceneRefs.controls;
          if (!controls) return;
          const url = buildShareUrl(useEclipseStore.getState(), getSimTimeMs(), controls);
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 2400);
          });
        }}
      >
        {copied ? <CheckIcon /> : <ShareIcon />}
      </button>
      {/* Portal: backdrop-filter panels are containing blocks for positioned
          descendants, so screen-centering requires escaping to <body>. */}
      {copied &&
        createPortal(
          <div className="share-toast" role="status">
            Link copied — it will show this exact view
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Isolated so its 8 Hz useSimTime tick re-renders only this button — putting
 * it in HUD made the whole tree (incl. the 680-row catalog) reconcile during
 * playback, which showed up as a periodic frame hitch.
 */
function EclipseLockButton() {
  const cameraPreset = useEclipseStore((s) => s.cameraPreset);
  const selectedEclipseId = useEclipseStore((s) => s.selectedEclipseId);
  const setCameraPreset = useEclipseStore((s) => s.setCameraPreset);
  const timeMs = useSimTime();
  const lockable = activeEclipse(timeMs, selectedEclipseId) !== null;
  return (
    <button
      className={`btn ${cameraPreset === "eclipse" ? "is-active" : ""}`}
      disabled={!lockable}
      onClick={() => setCameraPreset("eclipse")}
      title={
        lockable
          ? "Lock the camera on the ongoing eclipse"
          : "No eclipse in progress at the current time"
      }
    >
      Eclipse
    </button>
  );
}

/** About popover: one-line intro, the selected eclipse's facts, sources. */
function AboutPanel() {
  const selectedId = useEclipseStore((s) => s.selectedEclipseId);
  const utc = useEclipseStore((s) => s.timeDisplay === "utc");
  const e = getEclipse(selectedId)!;

  // The totality line runs astronomy-engine's local-eclipse search — memoized,
  // and only while the popover is open (this component mounts on demand).
  const facts: string[] = useMemo(() => {
    const out: string[] = [];
    if (e.type === "solar") {
      if (e.obscuration != null)
        out.push(`The Moon covers up to ${Math.round(e.obscuration * 100)}% of the Sun`);
      if (e.lat != null && e.lon != null) {
        out.push(`greatest eclipse over ${fmtLatLon(e.lat, e.lon)}`);
        const local = localSolarCircumstances(e.id, e.lat, e.lon);
        if (local.centralBeginMs !== null && local.centralEndMs !== null) {
          const durSec = (local.centralEndMs - local.centralBeginMs) / 1000;
          out.push(
            `${local.kind === "annular" ? "annularity" : "totality"} up to ${fmtDurationSec(durSec)}`,
          );
        }
      }
    } else if (e.sdTotalMin || e.sdPartialMin) {
      if (e.sdTotalMin) out.push(`Totality lasts ${fmtDurationMin(2 * e.sdTotalMin)}`);
      if (e.sdPartialMin) out.push(`partial phase ${fmtDurationMin(2 * e.sdPartialMin)}`);
    } else if (e.sdPenumMin) {
      out.push(`Penumbral phase lasts ${fmtDurationMin(2 * e.sdPenumMin)}`);
    }
    return out;
  }, [e]);

  return (
    <div className="about panel">
      <h3>
        Espilce
        <a
          className="about__by"
          href="https://github.com/larprad/espilce"
          target="_blank"
          rel="noreferrer"
        >
          by Larprad
        </a>
      </h3>
      <div className="about__eclipse">
        <div className="about__eclipse-title">
          <span className={`chip chip--${e.type}`}>{e.type}</span>
          <span>
            {eclipseTitle(e)} — {fmtDateTime(e.peakMs, utc)}
          </span>
        </div>
        {facts.length > 0 && <p className="about__facts">{facts.join(" · ")}</p>}
      </div>
      <p>
        Ephemeris by{" "}
        <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">
          astronomy-engine
        </a>
        . Textures by{" "}
        <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">
          Solar System Scope
        </a>{" "}
        (CC BY 4.0). City data by{" "}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames
        </a>{" "}
        (CC BY 4.0). Borders by{" "}
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
          Natural Earth
        </a>
        .
      </p>
      <p className="about__hint">
        Space — play/pause · Shift+←/→ — previous/next eclipse · drag to orbit, scroll to zoom
      </p>
    </div>
  );
}

export function HUD() {
  const cameraPreset = useEclipseStore((s) => s.cameraPreset);
  const showContours = useEclipseStore((s) => s.showContours);
  const showCities = useEclipseStore((s) => s.showCities);
  const [aboutOpen, setAboutOpen] = useState(false);
  const {
    setCameraPreset,
    setShowContours,
    setShowCities,
    togglePlay,
    jumpToPrev,
    jumpToNext,
  } = useEclipseStore.getState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" && e.shiftKey) {
        jumpToPrev();
      } else if (e.key === "ArrowRight" && e.shiftKey) {
        jumpToNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, jumpToPrev, jumpToNext]);

  // Click-away closes the About popover (the ⓘ button keeps its own toggle).
  useEffect(() => {
    if (!aboutOpen) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (t.closest(".about") || t.closest(".btn--info")) return;
      setAboutOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [aboutOpen]);

  return (
    <div className="hud">
      <div className="hud__top-left">
        <div className="brand">ESPILCE</div>
      </div>

      <div className="hud__top-center">
        <div className="eclipse-picker" role="group" aria-label="Eclipse picker">
          <button
            className="picker-arrow"
            onClick={() => jumpToPrev()}
            title="Previous eclipse (Shift+←)"
          >
            <ChevronLeft />
          </button>
          <EclipseStatus />
          <button
            className="picker-arrow"
            onClick={() => jumpToNext()}
            title="Next eclipse (Shift+→)"
          >
            <ChevronRight />
          </button>
        </div>
        <PickerHint />
      </div>

      <div className="hud__bottom-stack">
      <div className="hud__top-right-wrap">
        <div className="hud__top-right panel">
        <div className="preset-group" role="group" aria-label="Camera">
          <EclipseLockButton />
          {PRESETS.map(([id, label, hint]) => (
            <button
              key={id}
              className={`btn ${cameraPreset === id ? "is-active" : ""}`}
              onClick={() => setCameraPreset(id)}
              title={hint}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="hud__divider" />
        <button
          className={`btn ${showContours ? "is-active" : ""}`}
          onClick={() => setShowContours(!showContours)}
          title="Lines where 100/75/50/25% of the Sun is covered, dot at the maximum"
        >
          Lines
        </button>
        <button
          className={`btn ${showCities ? "is-active" : ""}`}
          onClick={() => setShowCities(!showCities)}
          title="City dots and names when zoomed in"
        >
          Cities
        </button>
        <ShareButton />
        </div>

        {showContours && (
          <div className="legend panel" title="Fraction of the Sun's disc covered">
            <span className="legend__title">Sun coverage</span>
            {(["100", "75", "50", "25"] as const).map((lv) => (
              <span key={lv} className={`legend__item legend__item--${lv}`}>
                <span className="legend__swatch" /> {lv}%
              </span>
            ))}
          </div>
        )}
      </div>
      <TimeControls onAbout={() => setAboutOpen((v) => !v)} />
      </div>

      {aboutOpen && <AboutPanel />}

      <CatalogPanel />
    </div>
  );
}
