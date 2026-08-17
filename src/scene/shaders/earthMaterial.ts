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
  uniform float uContours;    // 1.0 = draw obscuration iso-lines

  varying vec2 vUv;
  varying vec3 vDir;
  varying vec3 vViewDir;
  varying vec3 vGeoPosKm;

  ${eclipseCommonGlsl}

  // Crisp ~1px antialiased contour line of value v at the given level.
  float lineAt(float v, float level) {
    float px = abs(v - level) / max(fwidth(v), 1e-7);
    return 1.0 - smoothstep(0.5, 1.4, px);
  }

  void main() {
    // True WGS84 surface position — the shadow is evaluated on the real
    // oblate Earth even though the mesh renders as a sphere.
    vec3 sunDir = normalize(uSunPosKm);

    float coverage = sunCoverage(vGeoPosKm, uSunPosKm, uMoonPosKm, R_MOON_KM);

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

    // Optional overlay: iso-lines of Sun coverage (25/50/75%, and the ~100%
    // totality/annularity boundary). Cool-to-hot ramp: deeper eclipse,
    // warmer line.
    if (uContours > 0.5) {
      // Constants are ACES-inverse-compensated so the on-screen colors match
      // the legend's sRGB swatches (#6ea8ff / #80e0d1 / #ffb347 / #ff5738)
      // after the composer's tone mapping.
      vec3 lineColor = vec3(0.0);
      float lineAlpha = 0.0;
      vec3 C25 = vec3(0.0, 0.296, 2.5);      // blue
      vec3 C50 = vec3(0.0, 0.902, 0.626);    // teal
      vec3 C75 = vec3(1.67, 0.303, 0.014);   // amber
      vec3 C100 = vec3(1.167, 0.053, 0.03);  // red — totality edge

      float l25 = lineAt(coverage, 0.25);
      float l50 = lineAt(coverage, 0.50);
      float l75 = lineAt(coverage, 0.75);
      // 0.9995 rather than 1.0: the coverage plateau needs a hair of margin
      // for the fwidth-based line to resolve; verified against true totality
      // durations at Reims 1999 / Bilbao 2026 / Mexico 2024.
      float l100 = lineAt(coverage, 0.9995);
      lineColor = C25 * l25 + C50 * l50 + C75 * l75 + C100 * l100;
      lineAlpha = max(max(0.9 * l25, 0.9 * l50), max(0.95 * l75, l100));

      // Clip past the sunset/sunrise line: alignment persists geometrically
      // on the night side (the shadow axis exits Earth there), but no one
      // below the horizon sees an eclipse. Keep a twilight margin.
      lineAlpha *= smoothstep(-0.12, -0.02, ndl);
      color = mix(color, clamp(lineColor, 0.0, 1.0), clamp(lineAlpha, 0.0, 1.0));
    }

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
      uContours: { value: 0.0 },
    },
  });
}
