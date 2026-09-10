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
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const particleFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;
