import { ShaderMaterial, type Texture, Vector3 } from "three";
import { bodyVertexGlsl, eclipseCommonGlsl } from "./eclipseCommon";

/**
 * Moon surface: sunlit regolith that dims through Earth's penumbra and turns
 * blood-red in the umbra (light refracted through Earth's atmosphere), plus a
 * touch of earthshine on the night side. Outputs linear color; the composer
 * handles tone mapping.
 */
const fragment = /* glsl */ `
  uniform sampler2D uMoonMap;
  uniform vec3 uSunPosKm;
  uniform vec3 uMoonPosKm;

  varying vec2 vUv;
  varying vec3 vDir;
  varying vec3 vViewDir;

  ${eclipseCommonGlsl}

  void main() {
    vec3 fragPosKm = uMoonPosKm + vDir * R_MOON_KM;
    vec3 sunDir = normalize(uSunPosKm - fragPosKm);

    // Earth occludes; the 1.02 factor is the classic ~2% atmospheric
    // enlargement of the umbra.
    float coverage = sunCoverage(fragPosKm, uSunPosKm, vec3(0.0), R_EARTH_KM * 1.02);

    float ndl = max(dot(vDir, sunDir), 0.0);
    vec3 albedo = texture2D(uMoonMap, vUv).rgb;

    // Refracted sunset light: deep red, only meaningful near total coverage.
    vec3 umbraTint = vec3(0.45, 0.07, 0.02);
    vec3 sunlight = vec3(1.0) * (1.0 - coverage) + umbraTint * pow(coverage, 3.0);

    // Earthshine: faint fill from the (nearly) full Earth facing the night side.
    float earthshine = 0.012;

    vec3 color = albedo * (sunlight * ndl * 1.8 + earthshine);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createMoonMaterial(moonMap: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: bodyVertexGlsl,
    fragmentShader: fragment,
    uniforms: {
      uMoonMap: { value: moonMap },
      uSunPosKm: { value: new Vector3(1, 0, 0) },
      uMoonPosKm: { value: new Vector3(0, 0, 1) },
    },
  });
}
