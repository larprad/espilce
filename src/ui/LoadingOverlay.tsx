import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useEclipseStore } from "../state/store";

/**
 * Fullscreen overlay, visible from the very first React frame (no flash of
 * the raw scene). It hides when the scene's Suspense boundary has actually
 * resolved — keying off the loader's `active` flag alone flickers on mount
 * and never fires at all when assets come from cache.
 */
export function LoadingOverlay() {
  const sceneReady = useEclipseStore((s) => s.sceneReady);
  const { progress } = useProgress();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (sceneReady) {
      const t = setTimeout(() => setGone(true), 400);
      return () => clearTimeout(t);
    }
  }, [sceneReady]);

  if (gone) return null;
  return (
    <div
      className="loading-screen"
      style={{ opacity: sceneReady ? 0 : 1, transition: "opacity 350ms" }}
    >
      <div className="disc" />
      <div className="logo">Espilce</div>
      <div className="hint">Loading textures… {Math.round(progress)}%</div>
    </div>
  );
}
