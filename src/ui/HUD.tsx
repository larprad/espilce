import { useEffect, useState } from "react";
import { type CameraPreset, useEclipseStore } from "../state/store";
import { CatalogPanel } from "./CatalogPanel";
import { EclipseStatus } from "./EclipseStatus";
import { TimeControls } from "./TimeControls";

const PRESETS: Array<[CameraPreset, string, string]> = [
  ["earth", "Earth", "Center on Earth (click again to recenter)"],
  ["moon", "Moon", "Follow the Moon"],
  ["sun", "Sun", "Look at the Sun — during a solar eclipse the Moon crosses it"],
];

export function HUD() {
  const cameraPreset = useEclipseStore((s) => s.cameraPreset);
  const showContours = useEclipseStore((s) => s.showContours);
  const catalogOpen = useEclipseStore((s) => s.catalogOpen);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { setCameraPreset, setShowContours, setCatalogOpen, togglePlay, jumpToPrev, jumpToNext } =
    useEclipseStore.getState();

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
      </div>

      <div className="hud__top-right panel">
        <div className="preset-group" role="group" aria-label="Camera">
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
          className={`btn ${catalogOpen ? "is-active" : ""}`}
          onClick={() => setCatalogOpen(!catalogOpen)}
        >
          Catalog
        </button>
        <button className="btn btn--icon" onClick={() => setAboutOpen(!aboutOpen)} title="About">
          ?
        </button>
      </div>

      {aboutOpen && (
        <div className="about panel">
          <h3>Espilce</h3>
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
            (CC BY 4.0).
          </p>
          <p className="about__hint">
            Space — play/pause · Shift+←/→ — previous/next eclipse · drag to orbit, scroll to zoom
          </p>
        </div>
      )}

      {showContours && (
        <div className="legend panel" title="Fraction of the Sun's disc covered">
          {(["100", "75", "50", "25"] as const).map((lv) => (
            <span key={lv} className={`legend__item legend__item--${lv}`}>
              <span className="legend__swatch" /> {lv}%
            </span>
          ))}
        </div>
      )}

      <CatalogPanel />
      <TimeControls />
    </div>
  );
}
