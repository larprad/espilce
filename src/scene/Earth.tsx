import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { SRGBColorSpace, TextureLoader } from "three";
import { EARTH_DISPLAY_R } from "./scale";
import { sceneRefs } from "./sceneRefs";
import { createEarthMaterial } from "./shaders/earthMaterial";

/**
 * Texture calibration: three.js SphereGeometry has poles on +/-Y and the
 * equirect prime meridian on +X, while the body quaternion expects IAU body
 * axes (+Z pole, +X prime meridian). Rotating the mesh +90 deg about X maps
 * mesh +Y -> body +Z with the prime meridian preserved on +X.
 */
export const MESH_CALIBRATION_X = Math.PI / 2;

export function Earth() {
  const [dayMap, nightMap] = useLoader(TextureLoader, [
    "/textures/earth_day_4k.jpg",
    "/textures/earth_night_2k.jpg",
  ]);
  const material = useMemo(() => {
    for (const t of [dayMap, nightMap]) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
    }
    return createEarthMaterial(dayMap, nightMap);
  }, [dayMap, nightMap]);

  useEffect(() => {
    sceneRefs.earthMaterial = material;
    return () => {
      sceneRefs.earthMaterial = null;
      material.dispose();
    };
  }, [material]);

  return (
    <group ref={(g) => void (sceneRefs.earthGroup = g)}>
      <mesh rotation-x={MESH_CALIBRATION_X} material={material}>
        <sphereGeometry args={[EARTH_DISPLAY_R, 128, 96]} />
      </mesh>
    </group>
  );
}
