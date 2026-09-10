// Vapor flow adapted from the user-provided OVEN SAUNA DDP reference.
// Keep its upward drift, gradient noise, two plumes and soft diffusion;
// the transparent material is recolored to the OVEN SAUNA brand red.
export const vaporVertex = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = vec2((position.x + 1.0) * .5, 1.0 - (position.y + 1.0) * .5);
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const vaporFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uClock;
  uniform vec3 uColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 gradient(vec2 p) {
    float h = floor(hash(p) * 8.0);
    vec2 g = vec2(mod(h, 2.0) * 2.0 - 1.0, mod(floor(h * .5), 2.0) * 2.0 - 1.0);
    if (h >= 4.0) g = h < 6.0 ? vec2(g.x, 0.0) : vec2(0.0, g.x);
    return g;
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), s = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float n = mix(mix(dot(gradient(i), f), dot(gradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), s.x),
      mix(dot(gradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(gradient(i + 1.0), f - 1.0), s.x), s.y);
    return .5 + .7 * n;
  }
  float mist(vec2 p) { return noise(p) * .57 + noise(p * 2.03 + 7.2) * .28 + noise(p * 4.07 + 19.1) * .15; }

  void main() {
    float sway = sin(vUv.y * 8.0 - uClock * .24) * .018;
    float columns = exp(-pow((vUv.x - .31 - sway) / .094, 2.0))
      + exp(-pow((vUv.x - .72 + sway) / .099, 2.0));
    vec2 flow = vUv * vec2(22.0, 6.5) + vec2(uClock * .025, uClock * .23);
    flow += (vec2(noise(flow * .45 + vec2(0.0, uClock * .055)),
                  noise(flow * .45 + vec2(8.3, uClock * .04))) - .5) * 2.4;
    float vapor = smoothstep(.39, .69, mist(flow));
    vapor *= .65 + .35 * noise(flow * vec2(.8, 1.7) + 13.4);
    float edges = smoothstep(.10, .115, vUv.x) * (1.0 - smoothstep(.885, .90, vUv.x));
    float height = smoothstep(.025, .18, vUv.y) * (1.0 - smoothstep(.80, 1.0, vUv.y));
    float alpha = min(columns, 1.0) * vapor * height * edges * .56;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;
