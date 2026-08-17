import { useEffect, useState } from "react";
import { activeEclipse } from "../astro/catalog";
import { type CameraPreset, useEclipseStore } from "../state/store";
import { useSimTime } from "../state/useSimTime";
import { CatalogPanel } from "./CatalogPanel";
import { EclipseStatus } from "./EclipseStatus";
import { TimeControls } from "./TimeControls";

const PRESETS: Array<[CameraPreset, string, string]> = [
  ["earth", "Earth", "Center on Earth (click again to recenter)"],
  ["moon", "Moon", "Follow the Moon"],
  ["sun", "Sun", "Look at the Sun — during a solar eclipse the Moon crosses it"],
];

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

export function HUD() {
  const cameraPreset = useEclipseStore((s) => s.cameraPreset);
  const showContours = useEclipseStore((s) => s.showContours);
  const showCities = useEclipseStore((s) => s.showCities);
  const catalogOpen = useEclipseStore((s) => s.catalogOpen);
  const [aboutOpen, setAboutOpen] = useState(false);
  const {
    setCameraPreset,
    setShowContours,
    setShowCities,
    setCatalogOpen,
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

  return (
    <div className="hud">
      <div className="hud__top-left">
        <div className="brand">ESPILCE</div>
        <EclipseStatus />
        <div className="eclipse-nav" role="group" aria-label="Eclipse navigation">
          <button className="btn" onClick={() => jumpToPrev()} title="Previous eclipse (Shift+←)">
            ‹ Prev
          </button>
          <button
            className={`btn ${catalogOpen ? "is-active" : ""}`}
            onClick={() => setCatalogOpen(!catalogOpen)}
          >
            Catalog
          </button>
          <button className="btn" onClick={() => jumpToNext()} title="Next eclipse (Shift+→)">
            Next ›
          </button>
        </div>
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
        <button className="btn btn--icon" onClick={() => setAboutOpen(!aboutOpen)} title="About">
          ?
        </button>
        </div>

        {showContours && (
          <div className="legend panel" title="Fraction of the Sun's disc covered">
            {(["100", "75", "50", "25"] as const).map((lv) => (
              <span key={lv} className={`legend__item legend__item--${lv}`}>
                <span className="legend__swatch" /> {lv}%
              </span>
            ))}
          </div>
        )}
      </div>
      <TimeControls />
      </div>

      {aboutOpen && (
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
          <p>
            A 3D eclipse viewer. Positions come from real ephemeris data (
            <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">
              astronomy-engine
            </a>
            ); shadows are computed per-pixel from true Sun/Moon geometry. Distances are
            compressed for readability — directions and timings are real.
          </p>
          <p>
            Textures by{" "}
            <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">
              Solar System Scope
            </a>{" "}
            (CC BY 4.0). City data by{" "}
            <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
              GeoNames
            </a>{" "}
            (CC BY 4.0).
          </p>
          <p className="about__hint">
            Space — play/pause · Shift+←/→ — previous/next eclipse · drag to orbit, scroll to zoom
          </p>
        </div>
      )}

      <CatalogPanel />
    </div>
  );
}
