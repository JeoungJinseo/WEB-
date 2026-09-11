'use client';

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createTubeTransition, scrollTransition, transitionEase } from '@/lib/tube-transition';
import { advanceTube, tubeRingSpeedFactor } from '@/lib/image-tube';
const OvenImageTube = lazy(() => import('../image-tube/oven-image-tube'));
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
  const [tubeIntro, setTubeIntro] = useState(true);
  const introActive = useRef(tubeIntro);
  const transition = useRef(createTubeTransition());
  const pendingScene = useRef<number | null>(null);
  const returnToTube = useRef<() => void>(() => {});
  const releaseScroll = useRef<() => void>(() => {});
  const completeTube = useCallback(() => {
    introActive.current = false;
    releaseScroll.current();
    setTubeIntro(false);
    document.title = 'GOOBNE OVEN SAUNA — 2026 DDP Young Designer';
  }, []);
  const transitionProgress = useCallback((progress: number) => {
    rootRef.current?.style.setProperty('--tube-ring-opacity', String(transition.current.reduced ? transitionEase(.15, .4, progress) : progress >= .9 ? 1 : 0));
    rootRef.current?.style.setProperty('--tube-copy-opacity', String(transition.current.reduced ? transitionEase(.35, .55, progress) : transitionEase(.82, .98, progress)));
  }, []);
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

  useLayoutEffect(() => {
    document.body.classList.toggle('demo-tube', tubeIntro);
    return () => document.body.classList.remove('demo-tube');
  }, [tubeIntro]);

  useEffect(() => {
    if (!canvasRef.current || !rootRef.current || !wrapperRef.current || !contentRef.current || !containerRef.current) return;
    document.title = 'GOOBNE OVEN SAUNA — 2026 DDP Young Designer';
    let disposed = false;
    let animationFrame = 0;
    let fontsReady = false;
    let rewindPixels = 0;
    let touchY: number | null = null;
    let reversingTouch = false;
    let timeline: gsap.core.Timeline | undefined;
    let renderer: Renderer | undefined;
    let texture: Texture | undefined;
    let steamTexture: Texture | undefined;
    let cylinder: Mesh | undefined;
    let camera: Camera | undefined;
    let scene: Transform | undefined;
    const particles: ParticleMesh[] = [];
    const cameraPosition = { x: 0, y: 0, z: 8, fov: 45 };
    // Only the initial view reserves room for its introduction.
    // The canvas always fills the viewport; the opening lens offset blends
    // back to the original projection before the camera starts its flight.
    const openingBlend = { value: 1 };
    let opening = { fov: 45, shift: 0, copyTop: 0, centeredCopyTop: 0 };
    // Keep scroll and idle rotation separate so scrolling never resets the
    // angle reached while waiting, and idle rotation does not trigger steam.
    const scrollRotation = { y: .5 };
    let previousRotation = .5;
    const idleMotion = transition.current.motion;
    let previousFrame: number | undefined;
    let currentChapter = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    idleMotion.reduced = reducedMotion;
    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      smooth: reducedMotion ? 0 : 4,
      smoothTouch: reducedMotion ? 0 : .1,
      effects: false,
    });
    smoother.scrollTo(0, false);
    smoother.paused(introActive.current);
    releaseScroll.current = () => { document.body.classList.remove('demo-tube'); smoother.paused(false); ScrollTrigger.refresh(); };
    const context = gsap.context(() => {}, rootRef.current);
    const queueRewind = (pixels: number) => {
      if (introActive.current || !transition.current.ready || pixels >= 0) return false;
      // Carry the unused part of a wheel/touch gesture over the zero boundary.
      // A large upward gesture must not be lost when it reaches the first scene.
      const remaining = rewindPixels < 0 ? pixels : pixels + Math.max(0, window.scrollY);
      if (remaining >= 0) return false;
      rewindPixels = Math.max(-Math.max(1600, window.innerHeight * 2.2), rewindPixels + remaining);
      if (window.scrollY > 1) smoother.scrollTo(0, true);
      return true;
    };
    const onBoundaryWheel = (event: WheelEvent) => {
      if (event.ctrlKey || introActive.current) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      if (event.deltaY > 0) rewindPixels = 0;
      if (queueRewind(event.deltaY * unit)) event.preventDefault();
    };
    const onBoundaryKey = (event: KeyboardEvent) => {
      if (introActive.current || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === 'Home') { event.preventDefault(); returnToTube.current(); }
      else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        if (queueRewind(event.key === 'PageUp' ? -300 : -120)) event.preventDefault();
      } else if (event.key === 'ArrowDown' || event.key === 'PageDown') rewindPixels = 0;
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
      reversingTouch = false;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (touchY === null || event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const pixels = touchY - y;
      touchY = y;
      if (introActive.current && reversingTouch) {
        event.preventDefault();
        scrollTransition(transition.current, pixels * 2, window.innerHeight);
      } else if (queueRewind(pixels * 2)) {
        event.preventDefault();
        reversingTouch = true;
      }
    };
    const onTouchEnd = () => { touchY = null; reversingTouch = false; };
    window.addEventListener('wheel', onBoundaryWheel, { passive: false });
    window.addEventListener('keydown', onBoundaryKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);


    const dimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const radius = width < 768 ? 1.8 : width < 1024 ? 2.2 : 2.5;
      const scale = radius / cylinderConfig.radius;
      const fov = width < 768 ? 50 : 45;
      const cameraZ = width < 768 ? 6 : width < 1024 ? 7 : 8;
      return { width, height, scale, fov, cameraZ };
    };
    const resize = () => {
      const size = dimensions();
      renderer?.setSize(size.width, size.height);
      cameraPosition.fov = size.fov;
      camera?.perspective({ fov: size.fov, aspect: size.width / size.height });
      cylinder?.scale.set(size.scale, size.scale, size.scale);
      textRefs.current.forEach(element => {
        if (element) element.style.setProperty('--sauna-copy-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
      });
      const captionHeight = textRefs.current[0]?.getBoundingClientRect().height ?? 144;
      const headerHeight = parseFloat(getComputedStyle(rootRef.current!).getPropertyValue('--oven-header-height')) || 0;
      const top = headerHeight + 24;
      const bottom = size.height - Math.max(88, size.height * .1);
      const gap = Math.min(48, Math.max(24, size.height * .042));
      const imageHeight = Math.max(1, bottom - top - captionHeight - gap);
      const radius = cylinderConfig.radius * size.scale;
      const halfHeight = cylinderConfig.height * size.scale / 2;
      // Fit the entire opening cylinder by changing its projection, never by
      // cropping the renderer. All later views use the original field of view.
      const tangent = Math.max(
        Math.tan(size.fov * Math.PI / 360),
        size.height * halfHeight / (imageHeight * (size.cameraZ - radius)),
        size.height * radius / (Math.max(1, size.width - 48) * Math.sqrt(size.cameraZ ** 2 - radius ** 2)),
      );
      const ringHeight = size.height * halfHeight / (tangent * (size.cameraZ - radius));
      const groupTop = top + (bottom - top - ringHeight - gap - captionHeight) / 2;
      opening = {
        fov: 2 * Math.atan(tangent) * 180 / Math.PI,
        shift: 2 * (groupTop + ringHeight / 2) / size.height - 1,
        copyTop: groupTop + ringHeight + gap,
        centeredCopyTop: Math.max(size.height / 2 - captionHeight / 2, top),
      };
      if (renderer && camera && scene && cylinder) transition.current.ready = false;
      transition.current.frame = { fov: opening.fov, shift: opening.shift, scale: size.scale, cameraZ: size.cameraZ };
      rootRef.current!.style.setProperty('--sauna-intro-copy-top', `${opening.centeredCopyTop + (opening.copyTop - opening.centeredCopyTop) * openingBlend.value}px`);
    };
    const captionObserver = new ResizeObserver(resize);
    textRefs.current.forEach(element => { if (element) captionObserver.observe(element); });
    window.addEventListener('resize', resize);
    resize();
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
        timeline.fromTo(openingBlend, { value: 1 }, { value: 0, duration: unit, ease: 'saunaSmooth' }, 0);
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
          timeline.to(scrollRotation, { y: .5 + 28.27, duration: 100, ease: 'none' }, 0);
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
        rewindPixels = 0;
        const trigger = timeline?.scrollTrigger;
        if (!trigger) return;
        smoother.scrollTo(trigger.start + Math.max(0, Math.min(1, progress)) * (trigger.end - trigger.start), !reducedMotion);
      };
      returnToTube.current = () => {
        if (introActive.current) { transition.current.target = 0; return; }
        rewindPixels = -Math.max(1600, window.innerHeight * 2.2);
        smoother.scrollTo(0, true);
      };
      resize();
      const animate = (time: number) => {
        if (disposed) return;
        animationFrame = requestAnimationFrame(animate);
        const delta = previousFrame === undefined ? 0 : Math.min(.05, Math.max(0, (time - previousFrame) / 1000));
        previousFrame = time;
        if (document.hidden) return;
        // Wait for the cinematic camera to return to its exact opening pose,
        // then reverse the retained tube geometry at the same live rotation.
        if (!introActive.current && rewindPixels < 0 && smoother.scrollTop() <= 1 && (timeline?.progress() ?? 0) < .00001) {
          smoother.scrollTo(0, false);
          ScrollTrigger.update();
          ScrollTrigger.getAll().forEach(trigger => trigger.getTween()?.progress(1));
          timeline?.progress(0);
          previousRotation = scrollRotation.y;
          smoother.paused(true);
          transition.current.progress = 1;
          transition.current.target = 1;
          transition.current.velocity = 0;
          transition.current.layoutRevision++;
          introActive.current = true;
          transitionProgress(1);
          // Use the queued distance directly, including HOME's full rewind.
          transition.current.target = Math.max(0, 1 + rewindPixels / Math.max(1600, window.innerHeight * 2.2));
          rewindPixels = 0;
          setTubeIntro(true);
        }

        // This clock owns rotation for both renderers, including while the OGL
        // canvas is hidden. No restart or acceleration ramp at the handoff.
        if (fontsReady) {
          const weight = introActive.current ? 1 : 1 - transitionEase(0, .025, timeline?.progress() ?? 0);
          advanceTube(idleMotion, delta * weight);
        }
        if (!renderer || !camera || !scene || !cylinder) return;
        if (introActive.current && transition.current.ready && transition.current.progress < (transition.current.reduced ? .1 : .88)) return;
        const blend = openingBlend.value;
        const fov = cameraPosition.fov + (opening.fov - cameraPosition.fov) * blend;
        camera.perspective({ fov, aspect: window.innerWidth / window.innerHeight });
        camera.projectionMatrix[9] = opening.shift * blend;
        rootRef.current!.style.setProperty('--sauna-intro-copy-top', `${opening.centeredCopyTop + (opening.copyTop - opening.centeredCopyTop) * blend}px`);
        camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
        camera.lookAt([0, 0, 0]);
        cylinder.rotation.y = scrollRotation.y + idleMotion.angle * tubeRingSpeedFactor;
        const velocity = scrollRotation.y - previousRotation;
        previousRotation = scrollRotation.y;
        // Steam responds only to the original scroll rotation.
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
        transition.current.ready = fontsReady;
      };
      animationFrame = requestAnimationFrame(animate);
      setIsLoading(false);
      if (!renderer || !camera || !scene || !cylinder) transition.current.ready = true;
      document.fonts.ready.then(() => { if (!disposed) { fontsReady = true; resize(); ScrollTrigger.refresh(); } });
    }).catch(() => {
      if (!disposed) { setIsLoading(false); setLoadError(true); transition.current.ready = true; }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      captionObserver.disconnect();
      rootRef.current?.style.removeProperty('--sauna-intro-copy-top');
      window.removeEventListener('resize', resize);
      window.removeEventListener('wheel', onBoundaryWheel);
      window.removeEventListener('keydown', onBoundaryKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      navigateRef.current = () => {};
      context.revert();
      smoother.kill();
      releaseScroll.current = () => {};
      returnToTube.current = () => {};
      transition.current.ready = false;
      particles.forEach(particle => { particle.geometry.remove(); particle.program.remove(); });
      cylinder?.geometry.remove();
      cylinder?.program.remove();
      if (renderer && texture) renderer.gl.deleteTexture(texture.texture);
      if (renderer && steamTexture) renderer.gl.deleteTexture(steamTexture.texture);
    };
  }, []);

  useEffect(() => {
    if (!tubeIntro && pendingScene.current !== null) {
      navigateRef.current(pendingScene.current);
      pendingScene.current = null;
    }
  }, [tubeIntro]);

  const navigate = (progress: number) => {
    if (progress === 0) { returnToTube.current(); return; }
    if (introActive.current) {
      if (!transition.current.ready) return;
      pendingScene.current = progress;
      completeTube();
      return;
    }
    navigateRef.current(progress);
  };
  const nextScene = () => navigate(chapter === 0 ? .45 : chapter === 1 ? .75 : chapter === 2 ? 1 : 0);

  return (
    <div className={`oven-page${tubeIntro ? ' tube-journey-active' : ''}`} ref={rootRef}>
      <Loader isLoading={isLoading && !tubeIntro} className="bg-[#ED0505]" classNameLoader="bg-white" />
      <SaunaAtmosphere />
      <OvenFrame chapter={chapter} onNavigate={navigate} />
      <div className="sauna-scene" aria-label="OVEN SAUNA 원통형 그래픽 갤러리">
        {hasWebGL ? <canvas ref={canvasRef} role="img" aria-label="스티커, 티켓, 표지판, 눈, 유리 포스터, 수건 그래픽으로 이루어진 회전하는 원통" /> : <img className="sauna-fallback" src={images[0]} alt="OVEN SAUNA 스티커 그래픽" />}
      </div>
      <div className="sauna-copy" aria-hidden={tubeIntro}>
        {perspectives.map((perspective, index) => (
          <div className={`sauna-perspective sauna-perspective-${index}`} key={perspective.title}
            ref={element => { textRefs.current[index] = element; }} aria-hidden={chapter !== index}>
            <h2>{perspective.title}</h2>
            {perspective.description && <p className="sauna-perspective-description" lang="ko">{perspective.description}</p>}
          </div>
        ))}
      </div>
      {!tubeIntro && <button className="sauna-scroll-hint" onClick={nextScene} aria-label={chapter === 3 ? '처음으로' : '다음 시점으로 이동'}><span aria-hidden="true">{chapter === 3 ? '↑' : '↓'}</span>{chapter === 3 ? 'Back to top' : 'Scroll'}</button>}
      <Suspense fallback={<div className="tube-bootstrap"><img src="/brand/oven-sauna-logo.svg" alt="OVEN SAUNA" /></div>}>
        <OvenImageTube active={tubeIntro} transition={transition} onProgress={transitionProgress} onComplete={completeTube} />
      </Suspense>
      {loadError && <div className="sauna-error" role="alert">그래픽을 불러오지 못했습니다.<button onClick={() => window.location.reload()}>다시 불러오기</button></div>}
      <div ref={wrapperRef} id="smooth-wrapper"><div ref={contentRef} id="smooth-content"><div ref={containerRef} style={{ height: '500svh' }} /></div></div>
    </div>
  );
}
