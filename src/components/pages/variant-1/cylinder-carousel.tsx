'use client';

import { useEffect, useRef, useState } from 'react';
import { Renderer, Camera, Transform, Texture, Program, Mesh } from 'ogl';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { images, perspectives, cylinderConfig, particleConfig, imageConfig, imageRepeat } from '@/lib/variant-1/data';
import { drawImageContain, createCylinderGeometry, createParticleGeometry } from '@/lib/variant-1/utils';
import { cylinderVertex, cylinderFragment, particleVertex, particleFragment } from '@/lib/variant-1/shaders';
import type { ParticleMesh } from '@/lib/variant-1/types';
import Loader from '@/components/loader';
import { OvenFrame } from '@/components/oven-frame';
import '@/oven-sauna.css';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export function CylinderCarousel() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [chapter, setChapter] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const navigateRef = useRef<(progress: number) => void>(() => {});

  useEffect(() => {
    if (!canvasRef.current || !rootRef.current || !wrapperRef.current || !contentRef.current || !containerRef.current) return;
    document.title = 'GOOBNE OVEN SAUNA — 2026 DDP Young Designer';
    let disposed = false;
    let animationFrame = 0;
    let timeline: gsap.core.Timeline | undefined;
    let renderer: Renderer | undefined;
    let texture: Texture | undefined;
    let cylinder: Mesh | undefined;
    let camera: Camera | undefined;
    let scene: Transform | undefined;
    const particles: ParticleMesh[] = [];
    const cameraPosition = { x: 0, y: 0, z: 8, fov: 45 };
    let previousRotation = 0.5;
    let currentChapter = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      smooth: reducedMotion ? 0 : 2,
      smoothTouch: 0,
      effects: false,
    });
    const context = gsap.context(() => {}, rootRef.current);

    const dimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const radius = width < 768 ? 1.8 : 2.5;
      const scale = radius / cylinderConfig.radius;
      const fov = 45;
      const halfFov = Math.tan(fov * Math.PI / 360);
      const fit = Math.max(8 * scale, radius + Math.max(
        radius / (halfFov * (width / height) * .9),
        cylinderConfig.height * scale / (2 * halfFov * .65)
      ));
      const insideZ = .8 * scale;
      // A full portrait occupies 48% of the height at the center. The curved edges
      // rise naturally, matching the reference without covering the top frame.
      // On narrow displays, fit its width as well. The ring stays uniformly scaled.
      const insideFill = Math.min(.48, (width / height) / (imageConfig.width / imageConfig.height) * .82);
      const insideFov = 2 * Math.atan(cylinderConfig.height * scale / (2 * (radius + insideZ) * insideFill)) * 180 / Math.PI;
      return { width, height, scale, fov, fit, insideZ, insideFov };
    };
    const resize = () => {
      const size = dimensions();
      renderer?.setSize(size.width, size.height);
      camera?.perspective({ fov: cameraPosition.fov, aspect: size.width / size.height });
      cylinder?.scale.set(size.scale, size.scale, size.scale);
    };
    const originals = images.map(src => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    }));

    Promise.all(originals).then(loaded => {
      if (disposed) return;
      try {
        const size = dimensions();
        renderer = new Renderer({ canvas: canvasRef.current!, width: size.width, height: size.height,
          dpr: Math.min(window.devicePixelRatio, 2), alpha: true, antialias: true });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        camera = new Camera(gl, { fov: size.fov, aspect: size.width / size.height });
        cameraPosition.z = size.fit;
        scene = new Transform();
        const atlas = document.createElement('canvas');
        const ctx = atlas.getContext('2d', { alpha: false })!;
        const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), window.innerWidth < 768 ? 2048 : 8192);
        const unit = Math.max(1, Math.floor(Math.min(imageConfig.width / 4, imageConfig.height / 5, limit / (images.length * 4), limit / 5)));
        atlas.width = unit * 4 * images.length;
        atlas.height = unit * 5;
        ctx.fillStyle = '#080000';
        ctx.fillRect(0, 0, atlas.width, atlas.height);
        ctx.imageSmoothingQuality = 'high';
        loaded.forEach((image, index) => drawImageContain(ctx, image, index * unit * 4, 0, unit * 4, atlas.height));
        texture = new Texture(gl, { image: atlas, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
          minFilter: gl.LINEAR, magFilter: gl.LINEAR, generateMipmaps: false });
        const program = new Program(gl, { vertex: cylinderVertex, fragment: cylinderFragment,
          uniforms: { tMap: { value: texture }, uImageCount: { value: images.length }, uImageRepeat: { value: imageRepeat }, uDarkness: { value: 0 } }, cullFace: null });
        cylinder = new Mesh(gl, { geometry: createCylinderGeometry(gl, cylinderConfig), program });
        cylinder.setParent(scene);
        cylinder.rotation.y = .5;
        cylinder.scale.set(size.scale, size.scale, size.scale);
        for (let i = 0; i < particleConfig.numParticles; i++) {
          const { geometry, userData } = createParticleGeometry(gl, particleConfig, i, cylinderConfig.height);
          const particle = new Mesh(gl, { geometry, program: new Program(gl, {
            vertex: particleVertex, fragment: particleFragment,
            uniforms: { uColor: { value: [237 / 255, 5 / 255, 5 / 255] }, uOpacity: { value: 0 } }, transparent: true, depthTest: true,
          }), mode: gl.LINE_STRIP }) as ParticleMesh;
          particle.userData = userData;
          particle.setParent(scene);
          particles.push(particle);
        }
      } catch {
        // Keep an artwork visible if the device cannot create a WebGL context.
        setHasWebGL(false);
      }

      context.add(() => {
        gsap.set(textRefs.current, { autoAlpha: 0 });
        timeline = gsap.timeline({
          scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom bottom',
            scrub: reducedMotion ? true : .65, invalidateOnRefresh: true },
          onUpdate: () => {
            const progress = timeline!.progress();
            const nextChapter = progress < .2 ? 0 : progress < .51 ? 1 : progress < .88 ? 2 : 3;
            if (nextChapter !== currentChapter) { currentChapter = nextChapter; setChapter(nextChapter); }
          },
        });
        timeline.to({ value: 0 }, { value: 1, duration: 100, ease: 'none' }, 0);
        timeline.fromTo(cameraPosition, { x: 0, y: 0, z: () => dimensions().fit, fov: 45 },
          { x: 0, y: 0, z: () => dimensions().fit, fov: 45, duration: 10, ease: 'none' }, 0);
        timeline.to(cameraPosition, {
          x: 0,
          y: () => reducedMotion ? 0 : 5 * dimensions().scale,
          z: () => reducedMotion ? dimensions().fit : 5 * dimensions().scale,
          duration: 16, ease: 'power1.inOut',
        }, 10);
        timeline.to(cameraPosition, {
          x: () => reducedMotion ? 0 : 1.1 * dimensions().scale,
          y: () => reducedMotion ? 0 : 1.8 * dimensions().scale,
          z: () => reducedMotion ? dimensions().fit : 2 * dimensions().scale,
          duration: 16, ease: 'power1.inOut',
        }, 26);
        timeline.to(cameraPosition, {
          x: 0, y: 0,
          z: () => reducedMotion ? dimensions().fit : dimensions().insideZ,
          fov: () => reducedMotion ? 45 : dimensions().insideFov,
          duration: 10, ease: 'power2.inOut',
        }, 42);
        // A level, steady camera keeps the full ribbon visible during the inside pass.
        timeline.to(cameraPosition, {
          x: () => reducedMotion ? 0 : -6 * dimensions().scale,
          y: () => reducedMotion ? 0 : -dimensions().scale,
          z: () => dimensions().fit, fov: 45,
          duration: 14, ease: 'power2.inOut',
        }, 86);
        if (cylinder && !reducedMotion) {
          timeline.to(cylinder.rotation, { y: Math.PI * 4 + .5, duration: 42, ease: 'none' }, 0);
          timeline.to(cylinder.rotation, { y: Math.PI * 5 + .5, duration: 10, ease: 'power1.inOut' }, 42);
          // Half a turn brings every one of the six unique artworks past the camera.
          timeline.to(cylinder.rotation, { y: Math.PI * 6 + .5, duration: 34, ease: 'none' }, 52);
          timeline.to(cylinder.rotation, { y: Math.PI * 7 + .5, duration: 14, ease: 'power1.inOut' }, 86);
        }
        const textWindows = [
          { start: 1, end: 19 },
          { start: 23, end: 42 },
          { start: 51, end: 86 },
          { start: 91, end: 100 },
        ];
        textRefs.current.forEach((element, index) => {
          const window = textWindows[index];
          timeline!.to(element, { autoAlpha: 1, duration: 3, ease: 'power1.out' }, window.start);
          if (index < textWindows.length - 1) {
            timeline!.to(element, { autoAlpha: 0, duration: 3, ease: 'power1.in' }, window.end - 3);
          }
        });
      });
      navigateRef.current = progress => {
        const trigger = timeline?.scrollTrigger;
        if (!trigger) return;
        smoother.scrollTo(trigger.start + Math.max(0, Math.min(1, progress)) * (trigger.end - trigger.start), !reducedMotion);
      };
      window.addEventListener('resize', resize);
      const animate = () => {
        if (disposed) return;
        animationFrame = requestAnimationFrame(animate);
        if (!renderer || !camera || !scene || !cylinder) return;
        if (Math.abs(camera.fov - cameraPosition.fov) > .001) {
          camera.perspective({ fov: cameraPosition.fov, aspect: window.innerWidth / window.innerHeight });
        }
        camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
        camera.lookAt([0, 0, 0]);
        const velocity = cylinder.rotation.y - previousRotation;
        previousRotation = cylinder.rotation.y;
        particles.forEach(particle => {
          const opacity = particle.program.uniforms.uOpacity;
          opacity.value += (Math.min(Math.abs(velocity) * 60, .5) - opacity.value) * .15;
          if (Math.abs(velocity) < .00001) return;
          const data = particle.userData;
          data.baseAngle += velocity * data.speed;
          const positions = particle.geometry.attributes.position.data as Float32Array;
          for (let j = 0; j <= particleConfig.segments; j++) {
            const angle = data.baseAngle + data.angleSpan * j / particleConfig.segments;
            positions[j * 3] = Math.cos(angle) * data.radius;
            positions[j * 3 + 2] = Math.sin(angle) * data.radius;
          }
          particle.geometry.attributes.position.needsUpdate = true;
        });
        renderer.render({ scene, camera });
      };
      animate();
      setIsLoading(false);
      document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
    }).catch(() => {
      if (!disposed) { setIsLoading(false); setLoadError(true); }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      navigateRef.current = () => {};
      context.revert();
      smoother.kill();
      particles.forEach(particle => { particle.geometry.remove(); particle.program.remove(); });
      cylinder?.geometry.remove();
      cylinder?.program.remove();
      if (renderer && texture) renderer.gl.deleteTexture(texture.texture);
    };
  }, []);

  const navigate = (progress: number) => navigateRef.current(progress);
  const nextScene = () => navigate(chapter === 0 ? .34 : chapter === 1 ? .68 : chapter === 2 ? 1 : 0);

  return (
    <div className="oven-page" ref={rootRef}>
      <Loader isLoading={isLoading} className="bg-[#ED0505]" classNameLoader="bg-white" />
      <div className="sauna-atmosphere" aria-hidden="true"><div className="sauna-condensation" /><div className="sauna-glow" /><div className="sauna-vapor" /><div className="sauna-vignette" /></div>
      <OvenFrame chapter={chapter} onNavigate={navigate} />
      <div className="sauna-scene" aria-label="OVEN SAUNA 원통형 그래픽 갤러리">
        {hasWebGL ? <canvas ref={canvasRef} role="img" aria-label="스티커, 티켓, 표지판, 눈, 유리 포스터, 수건 그래픽으로 이루어진 회전하는 원통" /> : <img className="sauna-fallback" src={images[0]} alt="OVEN SAUNA 스티커 그래픽" />}
      </div>
      <div className="sauna-copy">
        {perspectives.map((perspective, index) => (
          <div className={`sauna-perspective sauna-perspective-${index}`} key={perspective.title}
            ref={element => { textRefs.current[index] = element; }} aria-hidden={chapter !== index}>
            <h2>{perspective.title}</h2>
            {perspective.description && <p>{perspective.description}</p>}
          </div>
        ))}
      </div>
      <footer className="oven-footer"><span>GOOBNE OVEN SAUNA</span><span>2026 DDP YOUNG DESIGNER</span></footer>
      <button className="sauna-scroll-hint" onClick={nextScene} aria-label={chapter === 3 ? '처음으로' : '다음 시점으로 이동'}><span aria-hidden="true">{chapter === 3 ? '↑' : '↓'}</span>{chapter === 3 ? 'Back to top' : 'Scroll'}</button>
      {loadError && <div className="sauna-error" role="alert">그래픽을 불러오지 못했습니다.<button onClick={() => window.location.reload()}>다시 불러오기</button></div>}
      <div ref={wrapperRef} id="smooth-wrapper"><div ref={contentRef} id="smooth-content"><div ref={containerRef} style={{ height: '800svh' }} /></div></div>
    </div>
  );
}
