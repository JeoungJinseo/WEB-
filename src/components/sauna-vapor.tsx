import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { vaporFragment, vaporVertex } from '@/lib/sauna-vapor';

/** Ambient steam keeps moving independently of the scroll-driven 3D arcs. */
export function SaunaVapor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    let renderer: Renderer;
    let geometry: Triangle | undefined;
    let program: Program | undefined;
    let mesh: Mesh;
    try {
      renderer = new Renderer({ canvas, alpha: true, premultipliedAlpha: true, depth: false, antialias: false, dpr: 1, webgl: 1 });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      geometry = new Triangle(gl);
      program = new Program(gl, {
        vertex: vaporVertex, fragment: vaporFragment,
        uniforms: { uClock: { value: 12 }, uColor: { value: [237 / 255, 5 / 255, 5 / 255] } },
        depthTest: false, depthWrite: false, cullFace: null,
      });
      mesh = new Mesh(gl, { geometry, program, frustumCulled: false });
    } catch {
      geometry?.remove();
      program?.remove();
      return; // The moving, red-tinted raster mist remains available as fallback.
    }

    const material = program;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let lastPaint = 0;
    let elapsed = 12;
    let contextLost = false;
    const draw = () => {
      if (contextLost) return;
      material.uniforms.uClock.value = elapsed;
      renderer.render({ scene: mesh });
    };
    const animate = (now: number) => {
      frame = 0;
      if (document.hidden || reduced.matches || contextLost) return;
      if (!lastPaint || now - lastPaint >= 32) {
        // A faint background drift, at one fifth of the previous flow speed.
        elapsed += lastPaint ? Math.min((now - lastPaint) / 1000, .1) * .2 : 0;
        lastPaint = now;
        draw();
      }
      frame = requestAnimationFrame(animate);
    };
    const syncPlayback = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastPaint = 0;
      if (document.hidden || contextLost) return;
      draw();
      if (!reduced.matches) frame = requestAnimationFrame(animate);
    };
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      // Soft vapor needs no Retina buffer; cap its cost beside the 3D gallery.
      renderer.dpr = Math.min(1, 960 / width, 720 / height);
      renderer.setSize(width, height);
      if (!document.hidden) draw();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frame);
      delete container.dataset.ready;
    };
    resize();
    container.dataset.ready = 'true';
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    document.addEventListener('visibilitychange', syncPlayback);
    reduced.addEventListener('change', syncPlayback);
    canvas.addEventListener('webglcontextlost', onContextLost);
    syncPlayback();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      reduced.removeEventListener('change', syncPlayback);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      geometry?.remove();
      material.remove();
      delete container.dataset.ready;
    };
  }, []);

  return (
    <div className="sauna-vapor" aria-hidden="true">
      <div className="sauna-vapor-fallback"><i /><i /></div>
      <canvas ref={canvasRef} className="sauna-vapor-canvas" />
    </div>
  );
}
