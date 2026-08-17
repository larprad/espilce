import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { SRGBColorSpace, TextureLoader } from "three";
import { MESH_CALIBRATION_X } from "./Earth";
import { MOON_DISPLAY_R } from "./scale";
import { sceneRefs } from "./sceneRefs";
import { createMoonMaterial } from "./shaders/moonMaterial";

export function Moon() {
  const moonMap = useLoader(TextureLoader, import.meta.env.BASE_URL + "textures/moon_2k.jpg");
  const material = useMemo(() => {
    moonMap.colorSpace = SRGBColorSpace;
    moonMap.anisotropy = 8;
    return createMoonMaterial(moonMap);
  }, [moonMap]);

  useEffect(() => {
    sceneRefs.moonMaterial = material;
    return () => {
      sceneRefs.moonMaterial = null;
      material.dispose();
    };
  }, [material]);

  return (
    <group ref={(g) => void (sceneRefs.moonGroup = g)}>
      <mesh rotation-x={MESH_CALIBRATION_X} material={material}>
        <sphereGeometry args={[MOON_DISPLAY_R, 96, 64]} />
      </mesh>
    </group>
  );
}
