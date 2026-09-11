import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type MutableRefObject } from 'react';
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { DoubleSide, ExtrudeGeometry, Group, ShaderChunk, SRGBColorSpace, Vector3 } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { useNavigate } from 'react-router-dom';
import { OvenFrame } from '@/components/oven-frame';
import { SaunaAtmosphere } from '@/components/sauna-atmosphere';
import { advanceTube, createTubeMotion, scrollTube, tubeArtworks, tubeConfig, type TubeMotion } from '@/lib/image-tube';
import '@/oven-sauna.css';
import './oven-image-tube.css';

type MotionRef = MutableRefObject<TubeMotion>;
interface HoverInfo { index: number; x: number; y: number }

function ArtworkTube({ motion, onHover, onReady }: { motion: MotionRef; onHover: (value: HoverInfo | null) => void; onReady: () => void }) {
  const textures = useTexture(tubeArtworks.map(art => art.src));
  const group = useRef<Group>(null);
  const rows = useRef<(Group | null)[]>([]);
  const { radius, columns, rowSpacing, tileHeight } = tubeConfig;
  const positions = useMemo(() => Array.from({ length: tubeConfig.rows * tubeConfig.repeats }, (_, index) => ({
    y: (index - (tubeConfig.rows * tubeConfig.repeats - 1) / 2) * rowSpacing,
    baseRow: index % tubeConfig.rows,
  })), [rowSpacing]);
  useEffect(() => {
    textures.forEach(texture => { texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; });
    onReady();
  }, [textures, onReady]);
  useFrame((_, delta) => {
    advanceTube(motion.current, delta);
    if (group.current) group.current.position.y = -motion.current.current;
    rows.current.forEach((row, index) => {
      if (row) row.rotation.y = motion.current.angle * (.65 + (index % tubeConfig.rows) / (tubeConfig.rows - 1) * .9);
    });
  });
  const hover = (event: ThreeEvent<PointerEvent>, index: number) => {
    event.stopPropagation();
    motion.current.hovered = true;
    onHover({ index, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
  };
  return <group ref={group}>
    {positions.map(({ y, baseRow }, rowIndex) => <group key={rowIndex} position={[0, y, 0]} ref={value => { rows.current[rowIndex] = value; }}>
      {Array.from({ length: columns }, (_, col) => {
        const theta = (col + (baseRow % 2 ? .5 : 0)) / columns * Math.PI * 2;
        const index = (baseRow * columns + col + baseRow) % textures.length;
        const texture = textures[index];
        const image = texture.image as HTMLImageElement;
        const aspect = image.naturalWidth / image.naturalHeight;
        return <mesh key={col} position={[Math.cos(theta) * radius, 0, Math.sin(theta) * radius]} rotation={[0, -(theta + Math.PI / 2), 0]}
          onPointerOver={event => hover(event, index)} onPointerMove={event => hover(event, index)}
          onPointerOut={event => { event.stopPropagation(); motion.current.hovered = false; onHover(null); }}>
          <planeGeometry args={[tileHeight * aspect, tileHeight]} />
          <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false}
            onBeforeCompile={shader => {
              // Keep typography readable on both the inner and outer faces.
              const map = ShaderChunk.map_fragment.replace('vMapUv', 'vec2(gl_FrontFacing ? vMapUv.x : 1.0 - vMapUv.x, vMapUv.y)');
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', map);
            }} customProgramCacheKey={() => 'oven-tube-readable-sides'} />
        </mesh>;
      })}
    </group>)}
  </group>;
}

function SaunaLogo({ motion, pointer }: { motion: MotionRef; pointer: MutableRefObject<{ x: number; y: number }> }) {
  const svg = useLoader(SVGLoader, '/brand/oven-sauna-logo.svg');
  const logo = useRef<Group>(null);
  const { camera, viewport, size } = useThree();
  const geometry = useMemo(() => {
    const shapes = svg.paths.flatMap(path => SVGLoader.createShapes(path));
    const result = new ExtrudeGeometry(shapes, { depth: 16, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.5, bevelSegments: 2, curveSegments: 10, steps: 1 });
    result.computeBoundingBox();
    const width = result.boundingBox!.max.x - result.boundingBox!.min.x;
    result.center();
    result.rotateX(Math.PI);
    result.scale(1 / width, 1 / width, 1 / width);
    return result;
  }, [svg]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const depth = 4.3;
  const view = viewport.getCurrentViewport(camera, new Vector3(0, 0, depth));
  const scale = view.width * (size.width < 768 ? .68 : .36);
  useFrame(() => {
    if (!logo.current) return;
    const amount = motion.current.reduced ? 0 : 1;
    logo.current.rotation.y += (pointer.current.x * .08 * amount - logo.current.rotation.y) * .06;
    logo.current.rotation.x += (-pointer.current.y * .04 * amount - logo.current.rotation.x) * .06;
  });
  return <group ref={logo} position={[0, 0, depth]} scale={scale}>
    <mesh position={[0, 0, -.09]}>
      <planeGeometry args={[1.65, .8]} />
      <shaderMaterial transparent depthWrite={false}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec2 vUv; void main(){float d=length((vUv-.5)*2.0); float alpha=(1.0-smoothstep(.08,1.0,d))*.72; gl_FragColor=vec4(0.015,0.0,0.0,alpha);}`} />
    </mesh>
    <mesh geometry={geometry}>
      <meshBasicMaterial attach="material-0" color="#ED0505" toneMapped={false} />
      <meshStandardMaterial attach="material-1" color="#690303" roughness={.45} metalness={.12} />
    </mesh>
  </group>;
}

class TubeBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function GalleryFallback({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return <div className="tube-fallback">
    <img className="tube-fallback-logo" src="/brand/oven-sauna-logo.svg" alt="OVEN SAUNA" />
    <div className="tube-fallback-grid">{tubeArtworks.map(art => <figure key={art.src}><img src={art.src} alt={art.title} /><figcaption>{art.title}</figcaption></figure>)}</div>
  </div>;
}

export default function OvenImageTube() {
  const root = useRef<HTMLDivElement>(null);
  const motion = useRef(createTubeMotion());
  const pointer = useRef({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(() => !('WebGL2RenderingContext' in window));
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const navigate = useNavigate();
  const onReady = useCallback(() => setReady(true), []);
  const onFallback = useCallback(() => { setReady(true); setUnavailable(true); }, []);
  useEffect(() => {
    if (ready) return;
    const timeout = window.setTimeout(onFallback, 12000);
    return () => window.clearTimeout(timeout);
  }, [ready, onFallback]);
  const onHover = useCallback((value: HoverInfo | null) => {
    if (drag.current) return;
    if (value && tooltip.current) {
      tooltip.current.style.left = `${Math.min(value.x + 18, window.innerWidth - 150)}px`;
      tooltip.current.style.top = `${Math.min(value.y + 18, window.innerHeight - 110)}px`;
    }
    setHovered(current => current?.index === value?.index ? current : value);
  }, []);
  useEffect(() => {
    document.title = 'OVEN SAUNA — Image Tube';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => { motion.current.reduced = reduced.matches; };
    const syncVisibility = () => setHidden(document.hidden);
    syncMotion();
    reduced.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    const surface = root.current!;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || unavailable) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      scrollTube(motion.current, event.deltaY * unit);
      setHovered(null);
      motion.current.hovered = false;
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => {
      reduced.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
      surface.removeEventListener('wheel', wheel);
    };
  }, [unavailable]);
  const pause = () => {
    const next = !paused;
    setPaused(next);
    motion.current.paused = next;
    if (next) motion.current.velocity = 0;
  };
  const openSection = (progress: number) => {
    if (progress === .75) { motion.current.target = 0; return; }
    navigate('/', { state: { scene: progress } });
  };
  return <div className={`oven-page sauna-tube${unavailable ? ' tube-static' : ''}`} ref={root}>
    <SaunaAtmosphere />
    <div className="tube-chrome-shade" aria-hidden="true" />
    <OvenFrame chapter={2} onNavigate={openSection} />
    <h1 className="tube-sr-only">OVEN SAUNA — Graphic archive</h1>
    <div className="tube-stage" role="region" aria-label="OVEN SAUNA 그래픽 튜브. 스크롤 또는 위아래 방향키로 이동합니다." tabIndex={0}
      onKeyDown={event => {
        if (unavailable) return;
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', ' '].includes(event.key)) event.preventDefault();
        if (event.key === 'ArrowDown' || event.key === 'PageDown') scrollTube(motion.current, event.key === 'PageDown' ? 300 : 120);
        if (event.key === 'ArrowUp' || event.key === 'PageUp') scrollTube(motion.current, event.key === 'PageUp' ? -300 : -120);
        if (event.key === 'Home') motion.current.target = 0;
        if (event.key === ' ') pause();
      }}
      onPointerDown={event => {
        if (event.button !== 0 || unavailable) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        setHovered(null);
        motion.current.hovered = false;
      }}
      onPointerMove={event => {
        pointer.current = { x: event.clientX / window.innerWidth * 2 - 1, y: event.clientY / window.innerHeight * 2 - 1 };
        if (drag.current?.id !== event.pointerId) return;
        scrollTube(motion.current, (drag.current.y - event.clientY) * 2);
        motion.current.angle += (event.clientX - drag.current.x) * .003;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onPointerLeave={() => { setHovered(null); motion.current.hovered = false; pointer.current = { x: 0, y: 0 }; }}>
      {unavailable ? <GalleryFallback onReady={onFallback} /> : <TubeBoundary fallback={<GalleryFallback onReady={onFallback} />}>
        <Canvas camera={{ position: [0, 0, 6.5], fov: 50 }} dpr={[1, 1.5]} frameloop={hidden ? 'never' : 'always'}
          gl={{ alpha: true, antialias: true }} fallback="OVEN SAUNA 그래픽 갤러리"
          onCreated={({ gl, camera }) => { gl.setClearColor(0x000000, 0); camera.lookAt(0, 0, 0); }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[3, 4, 6]} intensity={2} />
          <Suspense fallback={null}>
            <ArtworkTube motion={motion} onHover={onHover} onReady={onReady} />
            <SaunaLogo motion={motion} pointer={pointer} />
          </Suspense>
        </Canvas>
      </TubeBoundary>}
      {!ready && <img className="tube-loading-logo" src="/brand/oven-sauna-logo.svg" alt="OVEN SAUNA 그래픽 불러오는 중" />}
    </div>
    {hovered && <div className="tube-tooltip" ref={tooltip} style={{ left: Math.min(hovered.x + 18, window.innerWidth - 150), top: Math.min(hovered.y + 18, window.innerHeight - 110) }}>
      <span>{String(hovered.index + 1).padStart(2, '0')} / 06</span><strong>{tubeArtworks[hovered.index].title}</strong>
    </div>}
    <div className="tube-bottom-shade" aria-hidden="true" />
    {!unavailable && <div className="tube-instruction"><span aria-hidden="true">↕</span><p>스크롤해서 그래픽을 살펴보세요.</p></div>}
    {!unavailable && <button className="tube-pause" onClick={pause} aria-pressed={paused} aria-label={paused ? '자동 회전 재생' : '자동 회전 일시정지'}>{paused ? 'Play' : 'Pause'}</button>}
  </div>;
}
