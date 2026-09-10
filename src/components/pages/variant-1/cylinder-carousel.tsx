'use client';

import { useEffect, useRef, useState } from 'react';
import { Renderer, Camera, Transform, Texture, Program, Mesh } from 'ogl';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { CustomEase } from 'gsap/CustomEase';
import { images, perspectives, cylinderConfig, particleConfig, imageConfig, imageRepeat } from '@/lib/variant-1/data';
import { drawImageContain, createCylinderGeometry, createParticleGeometry } from '@/lib/variant-1/utils';
import { cylinderVertex, cylinderFragment, particleVertex, particleFragment } from '@/lib/variant-1/shaders';
import type { ParticleMesh } from '@/lib/variant-1/types';
import Loader from '@/components/loader';
import { OvenFrame } from '@/components/oven-frame';
import { SaunaAtmosphere } from '@/components/sauna-atmosphere';
import '@/oven-sauna.css';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, CustomEase);
CustomEase.create('saunaSilk', '0.45, 0.05, 0.55, 0.95');
CustomEase.create('saunaSmooth', '0.25, 0.1, 0.25, 1');
CustomEase.create('saunaFlow', '0.33, 0, 0.2, 1');
CustomEase.create('saunaLinear', '0.4, 0, 0.6, 1');

export function CylinderCarousel() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [chapter, setChapter] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const navigateRef = useRef<(progress: number) => void>(() => {});

  useEffect(() => {
    if (!canvasRef.current || !sceneRef.current || !rootRef.current || !wrapperRef.current || !contentRef.current || !containerRef.current) return;
    document.title = 'GOOBNE OVEN SAUNA — 2026 DDP Young Designer';
    let disposed = false;
    let animationFrame = 0;
    let timeline: gsap.core.Timeline | undefined;
    let renderer: Renderer | undefined;
    let texture: Texture | undefined;
    let steamTexture: Texture | undefined;
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
      smooth: reducedMotion ? 0 : 4,
      smoothTouch: reducedMotion ? 0 : .1,
      effects: false,
    });
    const context = gsap.context(() => {}, rootRef.current);

    const dimensions = () => {
      const viewportWidth = window.innerWidth;
      const width = Math.max(1, sceneRef.current!.clientWidth);
      const height = Math.max(1, sceneRef.current!.clientHeight);
      const radius = viewportWidth < 768 ? 1.8 : viewportWidth < 1024 ? 2.2 : 2.5;
      const scale = radius / cylinderConfig.radius;
      const baseFov = viewportWidth < 768 ? 50 : 45;
      const cameraZ = viewportWidth < 768 ? 6 : viewportWidth < 1024 ? 7 : 8;
      // Use the real canvas aspect ratio. Preserve a generous opening ring size
      // while containing it horizontally and reserving the separate caption row.
      const tangent = Math.tan(baseFov * Math.PI / 360);
      const projectedWidth = radius / (tangent * Math.sqrt(cameraZ ** 2 - radius ** 2));
      const framingHeight = Math.min(window.innerHeight, height * 1.35, width * .9 / projectedWidth);
      const fov = 2 * Math.atan(tangent * height / framingHeight) * 180 / Math.PI;
      return { width, height, scale, fov, cameraZ };
    };
    const resize = () => {
      const size = dimensions();
      renderer?.setSize(size.width, size.height);
      cameraPosition.fov = size.fov;
      camera?.perspective({ fov: size.fov, aspect: size.width / size.height });
      cylinder?.scale.set(size.scale, size.scale, size.scale);
    };
    const sceneObserver = new ResizeObserver(resize);
    sceneObserver.observe(sceneRef.current);
    window.addEventListener('resize', resize);
    const originals = [...images, './atmosphere/steam-reference.png'].map(src => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    }));

    Promise.all(originals).then(loaded => {
      if (disposed) return;
      const smokeImage = loaded.pop()!;
      try {
        const size = dimensions();
        renderer = new Renderer({ canvas: canvasRef.current!, width: size.width, height: size.height,
          dpr: Math.min(window.devicePixelRatio, 2), alpha: true, premultipliedAlpha: true, antialias: true });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        camera = new Camera(gl, { fov: size.fov, aspect: size.width / size.height });
        cameraPosition.z = size.cameraZ;
        cameraPosition.fov = size.fov;
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
        steamTexture = new Texture(gl, { image: smokeImage, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
          minFilter: gl.LINEAR, magFilter: gl.LINEAR, generateMipmaps: false });
        const program = new Program(gl, { vertex: cylinderVertex, fragment: cylinderFragment,
          uniforms: {
            tMap: { value: texture }, uImageCount: { value: images.length }, uImageRepeat: { value: imageRepeat },
            uPanelAspect: { value: 2 * Math.PI * cylinderConfig.radius / (images.length * imageRepeat * cylinderConfig.height) },
            uArtworkAspect: { value: imageConfig.width / imageConfig.height }, uDarkness: { value: .3 },
          }, cullFace: null });
        cylinder = new Mesh(gl, { geometry: createCylinderGeometry(gl, cylinderConfig), program });
        cylinder.setParent(scene);
        cylinder.rotation.y = .5;
        cylinder.scale.set(size.scale, size.scale, size.scale);
        for (let i = 0; i < particleConfig.numParticles; i++) {
          const { geometry, userData } = createParticleGeometry(gl, particleConfig, i, cylinderConfig.height);
          const particle = new Mesh(gl, { geometry, program: new Program(gl, {
            vertex: particleVertex, fragment: particleFragment,
            uniforms: {
              uColor: { value: [1, .96, .91] }, uOpacity: { value: 0 },
              tSteam: { value: steamTexture },
              uBaseAngle: { value: userData.baseAngle },
              uAngleSpan: { value: userData.angleSpan }, uRadius: { value: userData.radius },
              uBaseY: { value: userData.baseY }, uPhase: { value: userData.phase },
              uWidth: { value: userData.width },
            }, transparent: true, depthTest: true, depthWrite: false, cullFace: null,
          }), frustumCulled: false }) as ParticleMesh;
          particle.userData = userData;
          particle.setParent(scene);
          particles.push(particle);
        }
      } catch {
        // Keep an artwork visible if the device cannot create a WebGL context.
        setHasWebGL(false);
      }

      context.add(() => {
        // The opening copy must be readable before the first scroll input.
        gsap.set(textRefs.current.slice(1), { autoAlpha: 0 });
        gsap.set(textRefs.current[0], { autoAlpha: 1 });
        timeline = gsap.timeline({
          scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom bottom',
            scrub: reducedMotion ? true : 1, invalidateOnRefresh: true },
          onUpdate: () => {
            const progress = timeline!.progress();
            const nextChapter = progress < .3125 ? 0 : progress < .625 ? 1 : progress < .9375 ? 2 : 3;
            if (nextChapter !== currentChapter) { currentChapter = nextChapter; setChapter(nextChapter); }
          },
        });
        timeline.to({ value: 0 }, { value: 1, duration: 100, ease: 'none' }, 0);
        timeline.to('.sauna-background-left', { opacity: 1, duration: 10, ease: 'none' }, 20);
        timeline.to('.sauna-background-right', { opacity: 1, duration: 10, ease: 'none' }, 50);
        timeline.to('.sauna-background-right', { opacity: 0, duration: 10, ease: 'none' }, 86);
        // Original Codrops timings: 1 + 1 + 2 + 3.5 + 1 = 8.5 units.
        const unit = 100 / 8.5;
        timeline.fromTo(cameraPosition, { x: 0, y: 0, z: () => dimensions().cameraZ },
          { x: 0, y: 0, z: () => dimensions().cameraZ, duration: unit, ease: 'saunaSilk' }, 0);
        timeline.to(cameraPosition, {
          x: 0,
          y: reducedMotion ? 0 : 5,
          z: () => reducedMotion ? dimensions().cameraZ : 5,
          duration: unit, ease: 'saunaFlow',
        }, unit);
        timeline.to(cameraPosition, {
          x: reducedMotion ? 0 : 1.5,
          y: reducedMotion ? 0 : 2,
          z: () => reducedMotion ? dimensions().cameraZ : 2,
          duration: unit * 2, ease: 'saunaLinear',
        }, unit * 2);
        timeline.to(cameraPosition, {
          x: reducedMotion ? 0 : .5, y: 0,
          z: () => reducedMotion ? dimensions().cameraZ : .8,
          duration: unit * 3.5, ease: 'power1.inOut',
        }, unit * 4);
        timeline.to(cameraPosition, {
          x: reducedMotion ? 0 : -6,
          y: reducedMotion ? 0 : -1,
          z: () => dimensions().cameraZ,
          duration: unit, ease: 'saunaSmooth',
        }, unit * 7.5);
        if (cylinder && !reducedMotion) {
          timeline.to(cylinder.rotation, { y: .5 + 28.27, duration: 100, ease: 'none' }, 0);
        }
        textRefs.current.forEach((element, index) => {
          gsap.timeline({ scrollTrigger: {
            trigger: containerRef.current,
            start: `${index * 25}% top`, end: `${(index + 1) * 25}% top`,
            scrub: reducedMotion ? true : .8,
          } })
            .fromTo(element, { autoAlpha: index === 0 ? 1 : 0 }, { autoAlpha: 1, duration: .2, ease: 'saunaSmooth' })
            .to(element, { autoAlpha: 1, duration: .6, ease: 'none' })
            .to(element, { autoAlpha: 0, duration: .2, ease: 'saunaSmooth' });
        });
      });
      navigateRef.current = progress => {
        const trigger = timeline?.scrollTrigger;
        if (!trigger) return;
        smoother.scrollTo(trigger.start + Math.max(0, Math.min(1, progress)) * (trigger.end - trigger.start), !reducedMotion);
      };
      const animate = () => {
        if (disposed) return;
        animationFrame = requestAnimationFrame(animate);
        if (document.hidden) return;
        if (!renderer || !camera || !scene || !cylinder) return;
        if (Math.abs(camera.fov - cameraPosition.fov) > .001) {
          const size = dimensions();
          camera.perspective({ fov: cameraPosition.fov, aspect: size.width / size.height });
        }
        camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
        camera.lookAt([0, 0, 0]);
        const velocity = cylinder.rotation.y - previousRotation;
        previousRotation = cylinder.rotation.y;
        // Match Codrops' particle animation exactly: no idle drift or overlay.
        const speed = Math.abs(velocity) * 100;
        const isRotating = !reducedMotion && Math.abs(velocity) > .0001;
        particles.forEach(particle => {
          const uniforms = particle.program.uniforms;
          const targetOpacity = isRotating ? Math.min(speed * 3, .95) : 0;
          uniforms.uOpacity.value += (targetOpacity - uniforms.uOpacity.value) * .15;
          if (!isRotating) return;
          const data = particle.userData;
          data.baseAngle += velocity * data.speed * 1.5;
          uniforms.uBaseAngle.value = data.baseAngle;
        });
        renderer.render({ scene, camera });
      };
      animationFrame = requestAnimationFrame(animate);
      setIsLoading(false);
      document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
    }).catch(() => {
      if (!disposed) { setIsLoading(false); setLoadError(true); }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      sceneObserver.disconnect();
      window.removeEventListener('resize', resize);
      navigateRef.current = () => {};
      context.revert();
      smoother.kill();
      particles.forEach(particle => { particle.geometry.remove(); particle.program.remove(); });
      cylinder?.geometry.remove();
      cylinder?.program.remove();
      if (renderer && texture) renderer.gl.deleteTexture(texture.texture);
      if (renderer && steamTexture) renderer.gl.deleteTexture(steamTexture.texture);
    };
  }, []);

  const navigate = (progress: number) => navigateRef.current(progress);
  const nextScene = () => navigate(chapter === 0 ? .45 : chapter === 1 ? .75 : chapter === 2 ? 1 : 0);

  return (
    <div className="oven-page" ref={rootRef}>
      <Loader isLoading={isLoading} className="bg-[#ED0505]" classNameLoader="bg-white" />
      <SaunaAtmosphere />
      <OvenFrame chapter={chapter} onNavigate={navigate} />
      <div className="sauna-exhibit">
        <div className="sauna-scene" ref={sceneRef} aria-label="OVEN SAUNA 원통형 그래픽 갤러리">
          {hasWebGL ? <canvas ref={canvasRef} role="img" aria-label="스티커, 티켓, 표지판, 눈, 유리 포스터, 수건 그래픽으로 이루어진 회전하는 원통" /> : <img className="sauna-fallback" src={images[0]} alt="OVEN SAUNA 스티커 그래픽" />}
        </div>
        <div className="sauna-copy">
          {perspectives.map((perspective, index) => (
            <div className={`sauna-perspective sauna-perspective-${index}`} key={perspective.title}
              ref={element => { textRefs.current[index] = element; }} aria-hidden={chapter !== index}>
              <h2>{perspective.title}</h2>
              {perspective.description && <p className="sauna-perspective-description" lang="ko">{perspective.description}</p>}
            </div>
          ))}
        </div>
      </div>
      <button className="sauna-scroll-hint" onClick={nextScene} aria-label={chapter === 3 ? '처음으로' : '다음 시점으로 이동'}><span aria-hidden="true">{chapter === 3 ? '↑' : '↓'}</span>{chapter === 3 ? 'Back to top' : 'Scroll'}</button>
      {loadError && <div className="sauna-error" role="alert">그래픽을 불러오지 못했습니다.<button onClick={() => window.location.reload()}>다시 불러오기</button></div>}
      <div ref={wrapperRef} id="smooth-wrapper"><div ref={contentRef} id="smooth-content"><div ref={containerRef} style={{ height: '500svh' }} /></div></div>
    </div>
  );
}
