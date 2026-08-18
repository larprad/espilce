import { useEffect, useState } from "react";
import { CATALOG } from "../astro/catalog";
import { useEclipseStore } from "../state/store";

const SEEN_KEY = "espilce:picker-hint-seen";

const wasSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage unavailable — better never than every visit
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
};

/**
 * First-visit coach mark under the eclipse badge: the badge is the app's
 * navigation hub but wears the same clothes as the static panels, so point
 * it out once. Dismissed by any interaction, opening the catalog, or 8 s.
 */
export function PickerHint() {
  const sceneReady = useEclipseStore((s) => s.sceneReady);
  const [phase, setPhase] = useState<"pending" | "shown" | "hiding" | "done">(() =>
    wasSeen() ? "done" : "pending",
  );

  useEffect(() => {
    if (sceneReady && phase === "pending") setPhase("shown");
  }, [sceneReady, phase]);

  useEffect(() => {
    if (phase !== "shown") return;
    const dismiss = () => {
      markSeen();
      setPhase("hiding");
    };
    const timer = setTimeout(dismiss, 8000);
    window.addEventListener("pointerdown", dismiss);
    const unsub = useEclipseStore.subscribe((s, prev) => {
      if (s.catalogOpen && !prev.catalogOpen) dismiss();
    });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
      unsub();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "hiding") return;
    const t = setTimeout(() => setPhase("done"), 350);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase !== "shown" && phase !== "hiding") return null;
  return (
    <div
      className={`picker-hint ${phase === "hiding" ? "is-hiding" : ""}`}
      role="note"
      aria-hidden={phase === "hiding"}
    >
      Browse all {CATALOG.length} eclipses — 1950 to 2100
    </div>
  );
}
