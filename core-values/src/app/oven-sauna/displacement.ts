/**
 * Image displacement adapted from Robin Delaporte's hover-effect (MIT).
 * https://github.com/robin-dela/hover-effect
 * Uses WebGL directly so each instance can release its GPU resources on unmount.
 */
const vertex = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0., 1.);
}`;

const fragment = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D image;
uniform sampler2D displacement;
uniform float progress;
uniform float cropOffset;
uniform float restingShade;

mat2 rotation(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

void main() {
  vec2 uv = vec2(vUv.x, 1. - vUv.y);
  vec2 disp = texture2D(displacement, uv).rg;
  // Opposing distorted samples resolve to a clean image at either endpoint.
  vec2 uv1 = uv + rotation(0.785398) * disp * 0.24 * progress;
  vec2 uv2 = uv + rotation(-2.356194) * disp * 0.24 * (1. - progress);
  uv1.y = uv1.y / 1.222 + cropOffset;
  uv2.y = uv2.y / 1.222 + cropOffset;
  vec4 first = texture2D(image, clamp(uv1, 0.001, 0.999));
  vec4 second = texture2D(image, clamp(uv2, 0.001, 0.999));
  // These reproduce frame 01's gradient and frame 01-1's 70% dark veil.
  float topShade = 0.38 * (1. - smoothstep(0., 0.26, uv.y));
  float bottomShade = clamp(uv.y / 1.2678, 0., 1.);
  first.rgb *= (1. - max(topShade, bottomShade)) * (1. - restingShade);
  second.rgb *= 0.30 * (1. - topShade);
  gl_FragColor = mix(first, second, progress);
}`;

export type Displacement = { draw: (progress: number) => void; dispose: (releaseContext?: boolean) => void };

export function createDisplacement(
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement,
  cropOffset = 0,
  restingShade = 0,
): Displacement | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;

  const dispose = (releaseContext = false) => {
    textures.forEach((texture) => gl.deleteTexture(texture));
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    if (releaseContext) gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  try {
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error("Could not allocate shader");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error("Could not allocate program");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader linking failed");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = (unit: number, source: TexImageSource) => {
      const tex = gl.createTexture();
      if (!tex) throw new Error("Could not allocate texture");
      textures.push(tex);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    };

    // A deterministic, smooth displacement field: no external texture dependency.
    const map = document.createElement("canvas");
    map.width = map.height = 128;
    const ctx = map.getContext("2d");
    if (!ctx) throw new Error("Could not create displacement field");
    const pixels = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4;
      const wave = Math.sin(x * 0.038 + Math.sin(y * 0.057) * 2.4);
      const ripple = Math.cos(y * 0.071 - Math.cos(x * 0.043) * 1.7);
      pixels.data[i] = 128 + wave * 85;
      pixels.data[i + 1] = 128 + ripple * 85;
      pixels.data[i + 2] = 128;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    texture(0, photo);
    texture(1, map);
    gl.uniform1i(gl.getUniformLocation(program, "image"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "displacement"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "cropOffset"), cropOffset);
    gl.uniform1f(gl.getUniformLocation(program, "restingShade"), restingShade);
    const progressLocation = gl.getUniformLocation(program, "progress");
    const draw = (progress: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform1f(progressLocation, progress);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    draw(0);
    return { draw, dispose };
  } catch (error) {
    console.warn("Card uses its static image fallback:", error);
    dispose();
    return null;
  }
}
