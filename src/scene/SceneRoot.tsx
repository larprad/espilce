import { CameraControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Earth } from "./Earth";
import { Effects } from "./Effects";
import { Moon } from "./Moon";
import { CAMERA_WIDE } from "./scale";
import { SimulationDriver } from "./SimulationDriver";
import { Sun } from "./Sun";

export function SceneRoot() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: CAMERA_WIDE, fov: 42, near: 0.1, far: 500 }}
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
      </Suspense>
      <SimulationDriver />
      <CameraControls makeDefault minDistance={2} maxDistance={140} smoothTime={0.35} />
      <Effects />
    </Canvas>
  );
}
