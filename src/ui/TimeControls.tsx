import { SPEEDS, type Speed, useEclipseStore } from "../state/store";
import { useSimTime } from "../state/useSimTime";
import { CoarseSlider } from "./CoarseSlider";
import { FineSlider } from "./FineSlider";
import { fromDatetimeLocalUTC, toDatetimeLocalUTC } from "./format";

const SPEED_LABELS: Record<Speed, string> = {
  1: "1×",
  60: "1 min/s",
  600: "10 min/s",
  3600: "1 h/s",
  21600: "6 h/s",
  86400: "1 d/s",
};

/** Bottom dock: transport, speed, eclipse jumps, and the two sliders. */
export function TimeControls() {
  const timeMs = useSimTime();
  const playing = useEclipseStore((s) => s.basePerfMs !== null);
  const speed = useEclipseStore((s) => s.speed);
  const fineWindow = useEclipseStore((s) => s.fineWindow);
  const { togglePlay, setSpeed, setTime, jumpToPrev, jumpToNext, selectEclipse } =
    useEclipseStore.getState();

  return (
    <div className="dock panel">
      <div className="dock__row dock__row--transport">
        <button
          className="btn btn--icon btn--play"
          onClick={togglePlay}
          title={playing ? "Pause (space)" : "Play (space)"}
        >
          {playing ? "⏸" : "▶"}
        </button>

        <input
          className="datetime"
          type="datetime-local"
          value={toDatetimeLocalUTC(timeMs)}
          min={toDatetimeLocalUTC(Date.UTC(1950, 0, 1))}
          max={toDatetimeLocalUTC(Date.UTC(2100, 11, 31))}
          onChange={(e) => {
            const ms = fromDatetimeLocalUTC(e.target.value);
            if (Number.isFinite(ms)) setTime(ms);
          }}
          aria-label="Simulation date and time (UTC)"
        />
        <span className="utc-tag">UTC</span>

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

        <div className="jump-group">
          <button className="btn" onClick={() => jumpToPrev()} title="Previous eclipse (←)">
            ‹ Prev eclipse
          </button>
          <button className="btn" onClick={() => jumpToNext()} title="Next eclipse (→)">
            Next eclipse ›
          </button>
        </div>
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
