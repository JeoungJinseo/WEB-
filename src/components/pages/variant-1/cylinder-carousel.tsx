'use client';

import { useEffect, useRef, useState } from 'react';
import { Renderer, Camera, Transform, Texture, Program, Mesh } from 'ogl';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { images, artworks, cylinderConfig, particleConfig, imageConfig } from '@/lib/variant-1/data';
import { drawImageContain, createCylinderGeometry, createParticleGeometry } from '@/lib/variant-1/utils';
import { cylinderVertex, cylinderFragment, particleVertex, particleFragment } from '@/lib/variant-1/shaders';
import type { ParticleMesh } from '@/lib/variant-1/types';
import Loader from '@/components/loader';
import { OvenFrame } from '@/components/oven-frame';
import '@/oven-sauna.css';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// Each piece gets a full scroll beat, with short transitions and a long still hold.
const GALLERY_START = 36;
const ARTWORK_BEAT = 9;
const artworkProgress = (index: number) => (GALLERY_START + index * ARTWORK_BEAT + 4.5) / 100;

export function CylinderCarousel() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [chapter, setChapter] = useState(0);
  const [activeArtwork, setActiveArtwork] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const progressRef = useRef<HTMLSpanElement>(null);
  const navigateRef = useRef<(progress: number) => void>(() => {});
  const scrollProgressRef = useRef(0);

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
    const cameraPosition = { x: 0, y: 0, z: 10 };
    let previousRotation = 0.5;
    let currentChapter = 0;
    let currentArtwork = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      smooth: reducedMotion ? 0 : 1.25,
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
      const fit = radius + Math.max(radius / (halfFov * (width / height) * .86),
        cylinderConfig.height * scale / (2 * halfFov * .47));
      return { width, height, scale, fov, fit };
    };
    const resize = () => {
      const size = dimensions();
      renderer?.setSize(size.width, size.height);
      camera?.perspective({ fov: size.fov, aspect: size.width / size.height });
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
        ctx.fillStyle = '#310705';
        ctx.fillRect(0, 0, atlas.width, atlas.height);
        ctx.imageSmoothingQuality = 'high';
        loaded.forEach((image, index) => drawImageContain(ctx, image, index * unit * 4, 0, unit * 4, atlas.height));
        texture = new Texture(gl, { image: atlas, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
          minFilter: gl.LINEAR, magFilter: gl.LINEAR, generateMipmaps: false });
        const program = new Program(gl, { vertex: cylinderVertex, fragment: cylinderFragment,
          uniforms: { tMap: { value: texture }, uImageCount: { value: images.length }, uDarkness: { value: .05 } }, cullFace: null });
        cylinder = new Mesh(gl, { geometry: createCylinderGeometry(gl, cylinderConfig), program });
        cylinder.setParent(scene);
        cylinder.rotation.y = .5;
        cylinder.scale.set(size.scale, size.scale, size.scale);
        for (let i = 0; i < particleConfig.numParticles; i++) {
          const { geometry, userData } = createParticleGeometry(gl, particleConfig, i, cylinderConfig.height);
          const particle = new Mesh(gl, { geometry, program: new Program(gl, {
            vertex: particleVertex, fragment: particleFragment,
            uniforms: { uColor: { value: [1, .36, .18] }, uOpacity: { value: 0 } }, transparent: true, depthTest: true,
          }), mode: gl.LINE_STRIP }) as ParticleMesh;
          particle.userData = userData;
          particle.setParent(scene);
          particles.push(particle);
        }
      } catch {
        // The full-size artwork chapter remains usable if WebGL is unavailable.
        setHasWebGL(false);
      }

      context.add(() => {
        gsap.set([aboutRef.current, outroRef.current, galleryRef.current, ...cardRefs.current], { autoAlpha: 0 });
        timeline = gsap.timeline({
          scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom bottom',
            scrub: reducedMotion ? true : .45, invalidateOnRefresh: true },
          onUpdate: () => {
            const progress = timeline!.progress();
            scrollProgressRef.current = progress;
            if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
            const nextChapter = progress < .155 ? 0 : progress < .355 ? 1 : progress < .925 ? 2 : 3;
            const nextArtwork = Math.max(0, Math.min(5, Math.floor((progress * 100 - GALLERY_START) / ARTWORK_BEAT)));
            if (nextChapter !== currentChapter) { currentChapter = nextChapter; setChapter(nextChapter); }
            if (nextArtwork !== currentArtwork) { currentArtwork = nextArtwork; setActiveArtwork(nextArtwork); }
          },
        });
        // The clock keeps the last hold and every navigation target stable at 100 units.
        timeline.to({ value: 0 }, { value: 1, duration: 100, ease: 'none' }, 0);
        timeline.fromTo(cameraPosition, { x: 0, y: 0, z: () => dimensions().fit },
          { x: 0, y: 0, z: () => dimensions().fit, duration: 12, ease: 'none' }, 0);
        timeline.to(cameraPosition, { x: 0, y: reducedMotion ? 0 : 3.3,
          z: () => reducedMotion ? dimensions().fit : dimensions().fit * .78, duration: 12, ease: 'power1.inOut' }, 12);
        timeline.to(cameraPosition, { x: reducedMotion ? 0 : .35, y: 0,
          z: () => reducedMotion ? dimensions().fit : 1.25, duration: 13, ease: 'power2.inOut' }, 24);
        timeline.to(cameraPosition, { x: 0, y: 0, z: () => dimensions().fit, duration: 7, ease: 'power2.inOut' }, 92);
        if (cylinder && !reducedMotion) {
          timeline.to(cylinder.rotation, { y: Math.PI * 2 + .5, duration: 35, ease: 'none' }, 0);
          timeline.to(cylinder.rotation, { y: Math.PI * 3 + .5, duration: 8, ease: 'power1.inOut' }, 92);
        }
        timeline.to(heroRef.current, { autoAlpha: 0, y: -18, duration: 4 }, 12);
        timeline.fromTo(aboutRef.current, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 3 }, 16);
        timeline.to(aboutRef.current, { autoAlpha: 0, y: -16, duration: 3 }, 28);
        timeline.to(sceneLayerRef.current, { autoAlpha: 0, duration: 4 }, 33);
        timeline.to(galleryRef.current, { autoAlpha: 1, duration: 2 }, 34);
        cardRefs.current.forEach((card, index) => {
          const start = GALLERY_START + index * ARTWORK_BEAT;
          timeline!.fromTo(card, { autoAlpha: 0, y: reducedMotion ? 0 : 24, scale: reducedMotion ? 1 : .98 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 1.2, ease: 'power2.out', immediateRender: false }, start);
          timeline!.to(card, { autoAlpha: 0, y: reducedMotion ? 0 : -18, duration: 1, ease: 'power1.in', immediateRender: false }, start + ARTWORK_BEAT - 1);
        });
        timeline.to(galleryRef.current, { autoAlpha: 0, duration: 2 }, 90);
        timeline.to(sceneLayerRef.current, { autoAlpha: .16, duration: 5 }, 92);
        timeline.fromTo(outroRef.current, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 4 }, 93);
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
        const progress = scrollProgressRef.current;
        if (!renderer || !camera || !scene || !cylinder || (progress > .39 && progress < .92)) return;
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
  const nextScene = () => navigate(chapter === 0 ? .22 : chapter === 1 ? artworkProgress(0)
    : chapter === 2 ? activeArtwork < 5 ? artworkProgress(activeArtwork + 1) : 1 : 0);

  return (
    <div className="oven-page" ref={rootRef}>
      <Loader isLoading={isLoading} className="bg-[#9d1d13]" classNameLoader="bg-[#fff4e9]" />
      <div className="sauna-atmosphere" aria-hidden="true"><div className="sauna-condensation" /><div className="sauna-glow" /><div className="sauna-vapor" /><div className="sauna-vignette" /></div>
      <OvenFrame chapter={chapter} onNavigate={navigate} />
      <div className="sauna-scene" ref={sceneLayerRef} aria-hidden="true">
        {hasWebGL ? <canvas ref={canvasRef} /> : <img className="sauna-fallback" src={images[0]} alt="" />}
      </div>
      <div className="sauna-copy">
        <div className="sauna-hero" ref={heroRef} aria-hidden={chapter !== 0}>
          <div className="sauna-hero-heading"><p className="sauna-eyebrow">2026 DDP YOUNG DESIGNER</p><h1><img className="sauna-wordmark" src="./brand/wordmark.svg" alt="OVEN SAUNA" width="1292" height="296" /></h1></div>
          <p className="sauna-hero-note">SWEAT OUT, GATHER IN</p>
        </div>
        <div className="sauna-about" ref={aboutRef} aria-hidden={chapter !== 1}>
          <p className="sauna-eyebrow">GOOBNE × HONGIK UNIVERSITY</p><h2>SWEAT OUT.<br />GATHER IN.</h2><p>뜨거운 감각이 모이는 곳.<br />OVEN SAUNA의 그래픽을 만나보세요.</p>
        </div>
        <div className="sauna-outro" ref={outroRef} aria-hidden={chapter !== 3}>
          <p className="sauna-eyebrow">2026 DDP YOUNG DESIGNER</p><img className="sauna-wordmark" src="./brand/wordmark.svg" alt="OVEN SAUNA" width="1292" height="296" /><img className="sauna-collab" src="./brand/collab-white.svg" alt="GOOBNE X HONGIK UNIVERSITY" width="321" height="24" /><p>SWEAT OUT, GATHER IN</p>
        </div>
      </div>
      <section className="sauna-gallery" ref={galleryRef} aria-label="OVEN SAUNA 그래픽 6종" aria-hidden={chapter !== 2}>
        <div className="sauna-gallery-heading"><h2>Inside the Universe</h2><p>OVEN SAUNA — GRAPHIC ARCHIVE</p></div>
        {artworks.map((artwork, index) => (
          <figure className="sauna-artwork" key={artwork.title} ref={element => { cardRefs.current[index] = element; }} aria-hidden={chapter !== 2 || activeArtwork !== index}>
            <div className="sauna-artwork-image"><img src={images[index]} alt={artwork.alt} width={artwork.width} height={artwork.height} decoding="async" /></div>
            <figcaption className="sauna-artwork-caption"><span className="sauna-art-number">{String(index + 1).padStart(2, '0')}<small>/ 06</small></span><p>{artwork.category}</p><h3>{artwork.title}</h3><span>GOOBNE OVEN SAUNA<br />2026 DDP YOUNG DESIGNER</span></figcaption>
          </figure>
        ))}
        <nav className="sauna-gallery-nav" aria-label="그래픽 선택">{artworks.map((artwork, index) => <button key={artwork.title} aria-label={`${index + 1}. ${artwork.title} 보기`} aria-current={activeArtwork === index ? 'true' : undefined} tabIndex={chapter === 2 ? 0 : -1} onClick={() => navigate(artworkProgress(index))}>{String(index + 1).padStart(2, '0')}</button>)}</nav>
      </section>
      <footer className="oven-footer"><span>GOOBNE OVEN SAUNA</span><button className="oven-next" onClick={nextScene}>{chapter === 3 ? 'BACK TO THE HEAT' : 'SCROLL FOR NEXT SCENE'}<span aria-hidden="true">{chapter === 3 ? '↑' : '↓'}</span></button><span>2026 DDP YOUNG DESIGNER</span></footer>
      <div className="oven-progress" aria-hidden="true"><span ref={progressRef} /></div>
      {loadError && <div className="sauna-error" role="alert">그래픽을 불러오지 못했습니다.<button onClick={() => window.location.reload()}>다시 불러오기</button></div>}
      <div ref={wrapperRef} id="smooth-wrapper"><div ref={contentRef} id="smooth-content"><div ref={containerRef} style={{ height: '1400svh' }} /></div></div>
    </div>
  );
}
