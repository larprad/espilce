import { useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { SRGBColorSpace, TextureLoader } from "three";
import { CityLayer } from "./CityLayer";
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
  const gl = useThree((s) => s.gl);
  const [dayMap, nightMap, bordersMap] = useLoader(TextureLoader, [
    import.meta.env.BASE_URL + "textures/earth_day_8k.jpg",
    import.meta.env.BASE_URL + "textures/earth_night_8k.jpg",
    import.meta.env.BASE_URL + "textures/borders_8k.png",
  ]);
  const material = useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    for (const t of [dayMap, nightMap]) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = maxAniso;
    }
    // Borders are a data texture (line mask) — keep linear, no sRGB decode.
    bordersMap.anisotropy = maxAniso;
    return createEarthMaterial(dayMap, nightMap, bordersMap);
  }, [dayMap, nightMap, bordersMap, gl]);

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
        <sphereGeometry args={[EARTH_DISPLAY_R, 192, 128]} />
      </mesh>
      <group rotation-x={MESH_CALIBRATION_X}>
        <CityLayer />
      </group>
    </group>
  );
}
