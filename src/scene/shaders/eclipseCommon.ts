/**
 * Shared GLSL for analytic eclipse shadowing, evaluated per-fragment in REAL
 * space (km). Each fragment reconstructs its true position from the real
 * body radius + real orientation (mesh orientation matches reality even
 * though display distances are fake), then computes the fraction of the
 * Sun's disc covered by the occluding body: 0 = full sun, 1 = umbra.
 * Penumbra gradients and annularity (coverage < 1 at perfect centering)
 * fall out of the same circle–circle overlap formula.
 */
export const eclipseCommonGlsl = /* glsl */ `
  const float PI = 3.14159265358979;
  const float R_SUN_KM = 695700.0;
  const float R_EARTH_KM = 6371.0;
  const float R_MOON_KM = 1737.4;

  float sunCoverage(vec3 fragPosKm, vec3 sunPosKm, vec3 occPosKm, float occRadiusKm) {
    vec3 toSun = sunPosKm - fragPosKm;
    vec3 toOcc = occPosKm - fragPosKm;
    float distSun = length(toSun);
    float distOcc = length(toOcc);
    // Occluder must be between fragment and Sun (in front, and closer).
    if (distOcc >= distSun || dot(toOcc, toSun) <= 0.0) return 0.0;

    float radSun = asin(clamp(R_SUN_KM / distSun, 0.0, 1.0));
    float radOcc = asin(clamp(occRadiusKm / distOcc, 0.0, 1.0));

    // Angular separation. 2*asin(|a-b|/2) stays precise for tiny angles,
    // unlike acos(dot) which collapses in float32.
    vec3 dirSun = toSun / distSun;
    vec3 dirOcc = toOcc / distOcc;
    float sep = 2.0 * asin(clamp(0.5 * length(dirSun - dirOcc), 0.0, 1.0));

    if (sep >= radSun + radOcc) return 0.0;
    float rmin = min(radSun, radOcc);
    // One disc inside the other: umbra (occ >= sun) or annular ceiling (occ < sun).
    if (sep <= abs(radSun - radOcc)) return clamp((rmin * rmin) / (radSun * radSun), 0.0, 1.0);

    // Planar circle–circle overlap (angles are tiny; planar approx is exact enough).
    float rs2 = radSun * radSun;
    float ro2 = radOcc * radOcc;
    float d2 = sep * sep;
    float area = rs2 * acos(clamp((d2 + rs2 - ro2) / (2.0 * sep * radSun), -1.0, 1.0))
               + ro2 * acos(clamp((d2 + ro2 - rs2) / (2.0 * sep * radOcc), -1.0, 1.0))
               - 0.5 * sqrt(max(0.0, (-sep + radSun + radOcc) * (sep + radSun - radOcc)
                                   * (sep - radSun + radOcc) * (sep + radSun + radOcc)));
    // Clamp: float error near tangency can push the area a hair negative,
    // and a negative base makes the pow() in the materials NaN — which bloom
    // then smears across the whole frame.
    return clamp(area / (PI * rs2), 0.0, 1.0);
  }
`;

/**
 * Vertex shader shared by Earth and Moon: standard transform plus the
 * object-space unit direction of the vertex (varying), from which the
 * fragment shader reconstructs the real-space position — and, for Earth,
 * the true WGS84 surface position in km (vGeoPosKm). The sphere mesh is
 * parameterized by GEODETIC angles (that's what equirect textures and city
 * coordinates use), so on an oblate Earth the real surface point is NOT
 * dir * R: at 43 deg latitude the difference is ~20 km — enough to flip a
 * city in/out of totality at a path edge. Trig-free because the mesh pole
 * axis is +Y: N = a / sqrt(1 - e^2 sin^2(lat)) with sin(lat) = pm.y.
 */
export const bodyVertexGlsl = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vDir;      // world-space unit direction from body center
  varying vec3 vViewDir;  // world-space direction fragment -> camera
  varying vec3 vGeoPosKm; // world-space WGS84 surface position, km (Earth)

  void main() {
    vUv = uv;
    vec3 pm = normalize(position);
    vDir = normalize(mat3(modelMatrix) * pm);
    float N = 6378.137 / sqrt(1.0 - 0.00669438 * pm.y * pm.y);
    vGeoPosKm = mat3(modelMatrix) * vec3(N * pm.x, N * 0.99330562 * pm.y, N * pm.z);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;
