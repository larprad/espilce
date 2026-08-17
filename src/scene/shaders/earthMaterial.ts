import { ShaderMaterial, type Texture, Vector3 } from "three";
import { bodyVertexGlsl, eclipseCommonGlsl } from "./eclipseCommon";

/**
 * Earth surface: day/night texture blend across the real terminator, fresnel
 * atmosphere rim, and the Moon's shadow computed analytically in real space.
 * Outputs LINEAR color — tone mapping + sRGB conversion happen in the
 * postprocessing composer's final pass.
 */
const fragment = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform vec3 uSunPosKm;
  uniform vec3 uMoonPosKm;
  uniform float uShadowBoost; // 1.0 = physical; < 1.0 exaggerates the shadow spot

  varying vec2 vUv;
  varying vec3 vDir;
  varying vec3 vViewDir;

  ${eclipseCommonGlsl}

  void main() {
    vec3 fragPosKm = vDir * R_EARTH_KM; // Earth sits at the real-space origin
    vec3 sunDir = normalize(uSunPosKm);

    float coverage = sunCoverage(fragPosKm, uSunPosKm, uMoonPosKm, R_MOON_KM);
    coverage = pow(coverage, uShadowBoost);

    float ndl = dot(vDir, sunDir);
    float dayness = smoothstep(-0.08, 0.08, ndl);
    // Diffuse sun term (HDR headroom for the tone mapper), dimmed by the
    // eclipse. A wisp of light survives in the umbra so the spot reads as
    // shadow rather than a texture hole.
    float light = 1.8 * dayness * max(ndl, 0.0) * (1.0 - 0.985 * coverage);

    vec3 day = texture2D(uDayMap, vUv).rgb;
    vec3 night = texture2D(uNightMap, vUv).rgb;

    // City lights glow wherever direct sunlight is absent — including inside
    // the umbra during totality, which is physically what happens.
    float darkness = 1.0 - dayness * (1.0 - coverage);
    vec3 color = day * light + night * vec3(1.0, 0.85, 0.6) * 0.9 * darkness;

    // Warm tint along the terminator band.
    float twilight = smoothstep(0.12, 0.0, abs(ndl)) * dayness;
    color += day * vec3(0.35, 0.16, 0.05) * twilight;

    // Fresnel atmosphere rim, strongest on the lit side.
    float fresnel = pow(1.0 - clamp(dot(vViewDir, vDir), 0.0, 1.0), 3.0);
    color += vec3(0.18, 0.38, 0.85) * fresnel * (0.15 + 0.85 * dayness * (1.0 - coverage));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createEarthMaterial(dayMap: Texture, nightMap: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: bodyVertexGlsl,
    fragmentShader: fragment,
    uniforms: {
      uDayMap: { value: dayMap },
      uNightMap: { value: nightMap },
      uSunPosKm: { value: new Vector3(1, 0, 0) },
      uMoonPosKm: { value: new Vector3(0, 0, 1) },
      uShadowBoost: { value: 1.0 },
    },
  });
}
