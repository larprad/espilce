import { CameraControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { useEclipseStore } from "../state/store";
import { Earth } from "./Earth";
import { Effects } from "./Effects";
import { Moon } from "./Moon";
import { CAMERA_WIDE } from "./scale";
import { SimulationDriver } from "./SimulationDriver";
import { Sun } from "./Sun";

/** Mounts only once every suspended sibling (textures) has resolved. */
function SceneReady() {
  const setSceneReady = useEclipseStore((s) => s.setSceneReady);
  useEffect(() => setSceneReady(), [setSceneReady]);
  return null;
}

export function SceneRoot() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: CAMERA_WIDE, fov: 42, near: 0.02, far: 500 }}
      gl={{ antialias: true }}
      onCreated={(state) => {
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__r3f = state;
      }}
    >
      <color attach="background" args={["#020308"]} />
      <Stars radius={200} depth={80} count={5000} factor={4} saturation={0} fade speed={0.3} />
      <Suspense fallback={null}>
        <Earth />
        <Moon />
        <Sun />
        <SceneReady />
      </Suspense>
      <SimulationDriver />
      <CameraControls makeDefault minDistance={1.3} maxDistance={140} smoothTime={0.35} />
      <Effects />
    </Canvas>
  );
}
