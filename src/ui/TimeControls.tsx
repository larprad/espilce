import { SPEEDS, type Speed, useEclipseStore } from "../state/store";
import { useSimTime } from "../state/useSimTime";
import { CoarseSlider } from "./CoarseSlider";
import { FineSlider } from "./FineSlider";
import { fromDatetimeInput, toDatetimeInput, zoneLabel } from "./format";

const SPEED_LABELS: Record<Speed, string> = {
  1: "1×",
  60: "1 min/s",
  600: "10 min/s",
  3600: "1 h/s",
  21600: "6 h/s",
  86400: "1 d/s",
};

/* Inline SVG transport icons — text glyphs like ⏸ render as colored emoji
   on mobile browsers, so they can't be styled consistently. */
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M4.5 2.2 13.5 8l-9 5.8z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <rect x="3" y="2.2" width="3.4" height="11.6" rx="1" />
    <rect x="9.6" y="2.2" width="3.4" height="11.6" rx="1" />
  </svg>
);

/** Bottom dock: transport, speed, eclipse jumps, and the two sliders. */
export function TimeControls() {
  const timeMs = useSimTime();
  const playing = useEclipseStore((s) => s.basePerfMs !== null);
  const speed = useEclipseStore((s) => s.speed);
  const fineWindow = useEclipseStore((s) => s.fineWindow);
  const utc = useEclipseStore((s) => s.timeDisplay === "utc");
  const { togglePlay, setSpeed, setTime, selectEclipse, setTimeDisplay } =
    useEclipseStore.getState();

  return (
    <div className="dock panel">
      <div className="dock__row dock__row--transport">
        <button
          className="btn btn--icon btn--play"
          onClick={togglePlay}
          title={playing ? "Pause (space)" : "Play (space)"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <input
          className="datetime"
          type="datetime-local"
          step={1}
          value={toDatetimeInput(timeMs, utc)}
          min={toDatetimeInput(Date.UTC(1950, 0, 2), utc)}
          max={toDatetimeInput(Date.UTC(2100, 11, 30), utc)}
          onChange={(e) => {
            const ms = fromDatetimeInput(e.target.value, utc);
            if (Number.isFinite(ms)) setTime(ms);
          }}
          aria-label={`Simulation date and time (${zoneLabel(utc)})`}
        />
        <div className="speed-group" role="group" aria-label="Timezone">
          <button
            className={`btn btn--speed ${!utc ? "is-active" : ""}`}
            onClick={() => setTimeDisplay("local")}
            title={`Your timezone (${zoneLabel(false)})`}
          >
            {zoneLabel(false)}
          </button>
          <button
            className={`btn btn--speed ${utc ? "is-active" : ""}`}
            onClick={() => setTimeDisplay("utc")}
          >
            UTC
          </button>
        </div>

        <div className="speed-group" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`btn btn--speed ${s === speed ? "is-active" : ""}`}
              onClick={() => setSpeed(s)}
            >
              {SPEED_LABELS[s]}
            </button>
          ))}
        </div>
        {/* Mobile replacement for the speed buttons (CSS swaps them). */}
        <select
          className="speed-select"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value) as Speed)}
          aria-label="Playback speed"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {SPEED_LABELS[s]}
            </option>
          ))}
        </select>

      </div>

      {fineWindow ? (
        <div className="dock__row">
          <FineSlider />
          <button
            className="btn btn--icon"
            onClick={() => selectEclipse(null)}
            title="Back to full 1950–2100 range"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="dock__row">
          <CoarseSlider />
        </div>
      )}
    </div>
  );
}
