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
  uniform float uPanelAspect;
  uniform float uArtworkAspect;
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
    // Cover-fit the portrait within the original ring height without stretching.
    vec2 panelUv = vec2(tileU, vUv.y);
    if (uPanelAspect < uArtworkAspect) {
      panelUv.x = (panelUv.x - 0.5) * uPanelAspect / uArtworkAspect + 0.5;
    } else {
      panelUv.y = (panelUv.y - 0.5) * uArtworkAspect / uPanelAspect + 0.5;
    }
    vec2 artworkUv = vec2((tile + panelUv.x) / uImageCount, panelUv.y);
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
  uniform float uBaseAngle;
  uniform float uAngleSpan;
  uniform float uRadius;
  uniform float uBaseY;
  uniform float uPhase;
  uniform float uWidth;
  varying vec2 vUv;
  varying float vDepth;

  vec3 steamPoint(float t) {
    // Exact Codrops centerline: constant Y/radius and a 0.3-radian arc.
    float angle = uBaseAngle + uAngleSpan * t;
    return vec3(cos(angle) * uRadius, uBaseY, sin(angle) * uRadius);
  }

  void main() {
    vUv = uv;
    vec4 center = modelViewMatrix * vec4(steamPoint(uv.x) + position, 1.0);
    vec4 next = modelViewMatrix * vec4(steamPoint(uv.x + 0.002), 1.0);
    vec2 direction = next.xy - center.xy;
    vec2 normal = vec2(-direction.y, direction.x) / max(length(direction), 0.00001);
    float spread = 0.8 + 0.3 * sin(uv.x * 3.14159265);
    center.xy += normal * (uv.y * 2.0 - 1.0) * uWidth * spread;
    vDepth = -center.z;
    gl_Position = projectionMatrix * center;
  }
`;

export const particleFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tSteam;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    // Sample only the smoke above the incense stick; dark pixels turn transparent.
    vec2 smokeUv = vec2(vUv.y, 0.22 + vUv.x * 0.77);
    vec3 sampleColor = texture2D(tSteam, smokeUv).rgb * 0.5;
    sampleColor += texture2D(tSteam, smokeUv + vec2(0.006, 0.002)).rgb * 0.25;
    sampleColor += texture2D(tSteam, smokeUv - vec2(0.006, 0.002)).rgb * 0.25;
    float luminance = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
    float smoke = smoothstep(0.055, 0.7, luminance);
    float d = vUv.y * 2.0 - 1.0;
    float core = exp(-pow(d / 0.24, 2.0));
    float strand = exp(-pow((d - sin(vUv.x * 8.0 + uPhase) * 0.3) / 0.2, 2.0));
    float haze = exp(-pow(d / 0.65, 2.0));
    float edge = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
    float taper = pow(max(sin(vUv.x * 3.14159265), 0.0), 0.8);
    float density = 0.65 + smoke * 0.35;
    float alpha = (core * 0.3 + strand * 0.13 + haze * 0.12)
                * edge * taper * density * uOpacity;
    if (alpha < 0.002) discard;
    // The canvas is transparent over the red background. Premultiplied output
    // prevents the browser compositor from multiplying the faint steam again.
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;
