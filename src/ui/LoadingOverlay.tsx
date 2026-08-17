import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";

/** Fullscreen overlay while textures stream in; fades out when done. */
export function LoadingOverlay() {
  const { active, progress } = useProgress();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setGone(true), 350);
      return () => clearTimeout(t);
    }
  }, [active, progress]);

  if (gone) return null;
  return (
    <div className="loading-screen" style={{ opacity: active ? 1 : 0, transition: "opacity 300ms" }}>
      <div className="disc" />
      <div className="logo">Espilce</div>
      <div className="hint">Loading textures… {Math.round(progress)}%</div>
    </div>
  );
}
