export const cylinderVertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec3 position;
  
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const cylinderFragment = /* glsl */ `
  precision highp float;

  uniform sampler2D tMap;
  uniform float uImageCount;
  uniform float uImageRepeat;
  uniform float uDarkness; // 0.0 = normal, 1.0 = fully black

  varying vec2 vUv;

  void main() {
    // The original cylinder's U direction mirrors artwork on the outside.
    // Flip within each tile on front faces so the same graphic reads correctly
    // both outside the ring and during the camera's flight through its interior.
    float panelCount = uImageCount * uImageRepeat;
    float panel = min(floor(vUv.x * panelCount), panelCount - 1.0);
    float tileU = vUv.x * panelCount - panel;
    if (gl_FrontFacing) tileU = 1.0 - tileU;
    float tile = mod(panel, uImageCount);
    vec2 artworkUv = vec2((tile + tileU) / uImageCount, vUv.y);
    vec4 tex = texture2D(tMap, artworkUv);

    // Darken the texture
    tex.rgb *= (1.0 - uDarkness);

    gl_FragColor = tex;
  }
`;

export const particleVertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uBaseAngle;
  uniform float uAngleSpan;
  uniform float uRadius;
  uniform float uBaseY;
  uniform float uPhase;
  uniform float uWidth;
  varying vec2 vUv;
  varying float vDepth;

  vec3 steamPoint(float t) {
    float angle = uBaseAngle + uAngleSpan * (t - 0.5);
    float curl = sin(t * 7.5 + uPhase + uTime * 0.38);
    float radius = uRadius + curl * 0.075;
    float lift = sin(angle * 2.0 + uTime * 0.18 + uPhase) * 0.11
               + sin(t * 8.0 + uPhase - uTime * 0.65) * 0.075
               + (t - 0.5) * 0.22;
    return vec3(cos(angle) * radius, uBaseY + lift, sin(angle) * radius);
  }

  void main() {
    vUv = uv;
    vec4 center = modelViewMatrix * vec4(steamPoint(uv.x) + position, 1.0);
    vec4 next = modelViewMatrix * vec4(steamPoint(uv.x + 0.002), 1.0);
    vec2 direction = next.xy - center.xy;
    vec2 normal = vec2(-direction.y, direction.x) / max(length(direction), 0.00001);
    center.xy += normal * (uv.y * 2.0 - 1.0) * uWidth;
    vDepth = -center.z;
    gl_Position = projectionMatrix * center;
  }
`;

export const particleFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    float d = vUv.y * 2.0 - 1.0;
    float core = exp(-pow(d / 0.24, 2.0));
    float haze = exp(-pow(d / 0.62, 2.0));
    float taper = pow(max(sin(vUv.x * 3.14159265), 0.0), 0.8);
    float density = 0.8 + 0.2 * sin(vUv.x * 18.0 - uTime * 0.6 + uPhase);
    float nearFade = smoothstep(0.3, 1.2, vDepth);
    float alpha = (core * 0.6 + haze * 0.35) * taper * density * nearFade * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;
