import { SUN_DISPLAY_R } from "./scale";
import { sceneRefs } from "./sceneRefs";

/**
 * The Sun is an HDR-bright basic sphere; only it crosses the bloom
 * luminance threshold, so the glow is selective for free.
 */
export function Sun() {
  return (
    <mesh ref={(m) => void (sceneRefs.sunMesh = m)}>
      <sphereGeometry args={[SUN_DISPLAY_R, 64, 48]} />
      <meshBasicMaterial color={[8, 6, 3]} toneMapped={false} />
    </mesh>
  );
}
