import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export function Effects() {
  // Debug escape hatch: ?nofx renders the raw scene without the composer.
  if (new URLSearchParams(window.location.search).has("nofx")) return null;
  // multisampling=0: MSAA resolve on the float buffer produces block artifacts
  // on some GPUs/ANGLE backends; geometry here is smooth spheres, so AA loss
  // is negligible.
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.8} radius={0.7} />
      <Vignette darkness={0.5} offset={0.25} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
