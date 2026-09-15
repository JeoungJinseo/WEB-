import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type MutableRefObject } from 'react';
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { BufferAttribute, DoubleSide, DynamicDrawUsage, ExtrudeGeometry, Group, Mesh, PerspectiveCamera, PlaneGeometry, ShaderChunk, ShaderMaterial, Sphere, SRGBColorSpace, Vector3 } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { tubeArtworks, tubeConfig, tubeRingSpeedFactor, tubeRowSpeed, type TubeMotion } from '@/lib/image-tube';
import { advanceTransition, panelCoordinates, scrollTransition, transitionEase, type TubeTransition } from '@/lib/tube-transition';
import '@/oven-sauna.css';
import './oven-image-tube.css';

type MotionRef = MutableRefObject<TubeMotion>;
interface HoverInfo { index: number; x: number; y: number }

type TransitionRef = MutableRefObject<TubeTransition>;

function ArtworkTube({ motion, transition, onHover, onReady }: { motion: MotionRef; transition: TransitionRef; onHover: (value: HoverInfo | null) => void; onReady: () => void }) {
  const textures = useTexture(tubeArtworks.map(art => art.src));
  const meshes = useRef<(Mesh | null)[]>([]);
  const rotatingGroup = useRef<Group>(null);
  const { camera, size } = useThree();
  const cards = useMemo(() => Array.from({ length: tubeConfig.rows * tubeConfig.repeats * tubeConfig.columns }, (_, id) => {
    const row = Math.floor(id / tubeConfig.columns);
    const col = id % tubeConfig.columns;
    const baseRow = row % tubeConfig.rows;
    const panel = (col + baseRow) % tubeConfig.columns;
    const texture = textures[panel % textures.length];
    const image = texture.image as HTMLImageElement;
    const aspect = image.naturalWidth / image.naturalHeight;
    const columns = panelCoordinates(panel);
    const geometry = new PlaneGeometry(aspect, 1, columns.length - 1, 1);
    (geometry.attributes.position as BufferAttribute).setUsage(DynamicDrawUsage);
    geometry.boundingSphere = new Sphere();
    for (let vertex = 0; vertex < geometry.attributes.uv.count; vertex++) {
      geometry.attributes.uv.setX(vertex, columns[vertex % columns.length]);
    }
    return { row, col, baseRow, panel, texture, aspect, geometry,
      coordinates: new Float32Array(geometry.attributes.uv.array),
      gather: { value: 0 }, fit: { value: 1 }, endAngle: null as number | null, layoutRevision: -1,
    };
  }), [textures]);
  useEffect(() => () => cards.forEach(card => card.geometry.dispose()), [cards]);
  useEffect(() => {
    textures.forEach(texture => { texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; });
    onReady();
  }, [textures, onReady]);
  useFrame(() => {
    const progress = transition.current.progress;
    // One shared phase runs through gathering and the OGL handoff. Only the
    // rows' relative angles converge; their common rotation never settles.
    if (rotatingGroup.current) rotatingGroup.current.rotation.y = motion.current.angle * tubeRingSpeedFactor;
    const reduced = transition.current.reduced;
    const gather = reduced ? 0 : transitionEase(.02, .9, progress);
    const lens = reduced ? 0 : transitionEase(.04, .9, progress);
    // Assemble intact cards first; only then finish closing the curved surface.
    const collapse = reduced ? 0 : transitionEase(.02, .62, progress);
    const alignment = reduced ? 0 : transitionEase(.02, .65, progress);
    const endpoint = transition.current.frame;
    const perspective = camera as PerspectiveCamera;
    perspective.position.set(0, 0, 6.5 + (endpoint.cameraZ - 6.5) * lens);
    const introFov = 2 * Math.atan(Math.tan(50 * Math.PI / 360) / Math.min(1, Math.max(.7, size.width / size.height))) * 180 / Math.PI;
    perspective.fov = introFov + (endpoint.fov - introFov) * lens;
    perspective.updateProjectionMatrix();
    // Exactly the same off-axis opening lens as the prepared OGL scene.
    perspective.projectionMatrix.elements[8] = endpoint.shiftX * lens;
    perspective.projectionMatrix.elements[9] = endpoint.shift * lens;
    perspective.projectionMatrixInverse.copy(perspective.projectionMatrix).invert();
    const outerRadius = 4 + (2.5 * endpoint.scale - 4) * gather;
    const outerHeight = 1 + (2 * endpoint.scale - 1) * gather;
    const recess = transitionEase(.015, .38, progress);
    cards.forEach((card, id) => {
      if (card.layoutRevision !== transition.current.layoutRevision) {
        card.endAngle = null;
        card.layoutRevision = transition.current.layoutRevision;
      }
      const mesh = meshes.current[id];
      if (!mesh) return;
      const distance = Math.abs(card.row - 7);
      // Opaque cards nest at distinct depths. Never fade intersecting surfaces:
      // transparent rows at the same radius create the sliced/ghosted image artifact.
      mesh.visible = distance === 0 || progress < .91;
      if (!mesh.visible) return;
      const layer = distance === 0 ? 0 : distance * 2 - (card.row < 7 ? 1 : 0);
      const radius = outerRadius * (1 - layer * .022 * recess);
      const layerScale = radius / outerRadius;
      const height = outerHeight * layerScale;
      card.gather.value = gather;
      const width = (outerHeight * card.aspect * (1 - gather) + (2 * Math.PI * 2.5 * endpoint.scale / 12) * gather) * layerScale;
      card.fit.value = width / (height * card.aspect);
      const thetaStart = (card.col + (card.baseRow % 2 ? .5 : 0)) / 12 * Math.PI * 2
        - motion.current.angle * (tubeRowSpeed(card.baseRow) - tubeRingSpeedFactor);
      const thetaEnd = (card.panel + .5) / 12 * Math.PI * 2 - .5;
      if (progress === 0 && transition.current.target === 0) card.endAngle = null;
      // Keep one continuous relative angular path while the whole group rotates.
      // Recomputing the shortest angle can otherwise jump at the +/- PI seam.
      card.endAngle ??= thetaStart + Math.atan2(Math.sin(thetaEnd - thetaStart), Math.cos(thetaEnd - thetaStart));
      const center = thetaStart + (card.endAngle - thetaStart) * alignment;
      const rowY = ((card.row - 7) * tubeConfig.rowSpacing - motion.current.current) * (1 - collapse);
      const positions = card.geometry.attributes.position;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const u = card.coordinates[vertex * 2];
        const v = card.coordinates[vertex * 2 + 1];
        const x = (u - .5) * width;
        const flatX = Math.cos(center) * radius - Math.sin(center) * x;
        const flatZ = Math.sin(center) * radius + Math.cos(center) * x;
        // Match the original 64-sided cylinder, including its polygon edges.
        const angle = center + (u - .5) * width / radius;
        const segment = (angle + .5) / (Math.PI * 2) * 64;
        const first = Math.floor(segment);
        const fraction = segment - first;
        const a = first / 64 * Math.PI * 2 - .5;
        const b = (first + 1) / 64 * Math.PI * 2 - .5;
        const curvedX = radius * (Math.cos(a) + (Math.cos(b) - Math.cos(a)) * fraction);
        const curvedZ = radius * (Math.sin(a) + (Math.sin(b) - Math.sin(a)) * fraction);
        positions.setXYZ(vertex, flatX + (curvedX - flatX) * gather, rowY + (v - .5) * height, flatZ + (curvedZ - flatZ) * gather);
      }
      positions.needsUpdate = true;
      // Keep culling correct without rescanning every vertex of every card.
      card.geometry.boundingSphere!.center.set(Math.cos(center) * radius, rowY, Math.sin(center) * radius);
      card.geometry.boundingSphere!.radius = Math.hypot(width, height) * .5 + .08;
    });
  });
  const hover = (event: ThreeEvent<PointerEvent>, index: number) => {
    if (transition.current.target > 0 || event.pointerType === 'touch') return;
    event.stopPropagation();
    onHover({ index, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
  };
  return <group ref={rotatingGroup}>{cards.map((card, id) => <mesh key={id} ref={value => { meshes.current[id] = value; }} geometry={card.geometry} frustumCulled
    onPointerOver={event => hover(event, card.panel % tubeArtworks.length)} onPointerMove={event => hover(event, card.panel % tubeArtworks.length)}
    onPointerOut={event => { event.stopPropagation(); onHover(null); }}>
    <meshBasicMaterial map={card.texture} side={DoubleSide} toneMapped={false} depthWrite depthTest
      onBeforeCompile={shader => {
        shader.uniforms.uGather = card.gather;
        shader.uniforms.uFit = card.fit;
        shader.fragmentShader = 'uniform float uGather; uniform float uFit;\n' + shader.fragmentShader;
        // Cover-fit in either direction with the same scale on both image axes.
        const uv = 'vec2(((gl_FrontFacing ? vMapUv.x : 1.0-vMapUv.x)-.5)*min(1.0,uFit)+.5,(vMapUv.y-.5)/max(1.0,uFit)+.5)';
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', ShaderChunk.map_fragment.replace('vMapUv', uv));
        shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', '#include <colorspace_fragment>\ngl_FragColor.rgb *= mix(1.0, .7, uGather);');
      }} customProgramCacheKey={() => 'oven-tube-convergence'} />
  </mesh>)}</group>;
}

function SaunaLogo({ motion, pointer, transition }: { motion: MotionRef; pointer: MutableRefObject<{ x: number; y: number }>; transition: TransitionRef }) {
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
  const logoTarget = useMemo(() => new Vector3(0, 0, depth), []);
  useFrame(() => {
    if (!logo.current) return;
    const view = viewport.getCurrentViewport(camera, logoTarget);
    const fluid = Math.max(0, Math.min(1, (size.width - 600) / 424));
    logo.current.scale.setScalar(Math.min(view.width * (.68 - .32 * fluid), view.height * 1.6));
    const fade = 1 - transitionEase(.02, .24, transition.current.progress);
    logo.current.visible = fade > .001;
    logo.current.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (material instanceof ShaderMaterial) material.uniforms.uFade.value = fade;
        else { material.transparent = true; material.opacity = fade; }
      });
    });
    const amount = motion.current.reduced ? 0 : 1;
    logo.current.rotation.y += (pointer.current.x * .08 * amount - logo.current.rotation.y) * .06;
    logo.current.rotation.x += (-pointer.current.y * .04 * amount - logo.current.rotation.x) * .06;
  });
  return <group ref={logo} position={[0, 0, depth]}>
    <mesh position={[0, 0, -.09]}>
      <planeGeometry args={[1.65, .8]} />
      <shaderMaterial transparent depthWrite={false} uniforms={{ uFade: { value: 1 } }}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`uniform float uFade; varying vec2 vUv; void main(){float d=length((vUv-.5)*2.0); float alpha=(1.0-smoothstep(.08,1.0,d))*.72; gl_FragColor=vec4(0.015,0.0,0.0,alpha*uFade);}`} />
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

export default function OvenImageTube({ active, transition, onProgress, onComplete }: {
  active: boolean; transition: TransitionRef; onProgress: (progress: number) => void; onComplete: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const motion = useMemo<MotionRef>(() => ({ current: transition.current.motion }), [transition]);
  const pointer = useRef({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(() => !('WebGL2RenderingContext' in window));
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);

  useLayoutEffect(() => {
    if (!active) return;
    // Restore the retained canvas invisibly at the endpoint before revealing it.
    const progress = transition.current.progress;
    root.current?.style.setProperty('--tube-opacity', String(1 - (transition.current.reduced ? transitionEase(.15, .4, progress) : transitionEase(.9, 1, progress))));
    root.current?.style.setProperty('--tube-ui-opacity', String(1 - transitionEase(.02, .22, progress)));
  }, [active, transition]);

  const onReady = useCallback(() => setReady(true), []);
  const onFallback = useCallback(() => { setReady(true); setUnavailable(true); }, []);
  useEffect(() => {
    if (ready) return;
    const timeout = window.setTimeout(onFallback, 12000);
    return () => window.clearTimeout(timeout);
  }, [ready, onFallback]);
  const move = useCallback((pixels: number) => {
    if (!ready || !active) return;
    scrollTransition(transition.current, pixels, window.innerHeight);
    setHovered(null);
  }, [ready, active, transition]);
  useEffect(() => {
    if (!active) return;
    if (transition.current.progress > 0) root.current?.querySelector<HTMLElement>('.tube-stage')?.focus({ preventScroll: true });
    let frame = 0;
    let previous = performance.now();
    let finished = false;
    const animate = (time: number) => {
      const elapsed = (time - previous) / 1000;
      previous = time;
      if (!document.hidden && ready) {
        advanceTransition(transition.current, elapsed, motion.current.reduced);
        // Both scenes already share the exact pose here; avoid trapping input
        // during the spring's imperceptible final tail.
        if (transition.current.target === 1 && transition.current.progress >= .995) {
          transition.current.progress = 1;
          transition.current.velocity = 0;
        }
        const progress = transition.current.progress;
        onProgress(progress);
        root.current?.style.setProperty('--tube-opacity', String(1 - (transition.current.reduced ? transitionEase(.15, .4, progress) : transitionEase(.9, 1, progress))));
        root.current?.style.setProperty('--tube-ui-opacity', String(1 - transitionEase(.02, .22, progress)));
        if (progress === 1 && transition.current.target === 1 && !finished) { finished = true; onComplete(); return; }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, ready, transition, onProgress, onComplete]);
  const onHover = useCallback((value: HoverInfo | null) => {
    if (drag.current) return;
    if (value && tooltip.current) {
      tooltip.current.style.left = `${Math.min(value.x + 18, window.innerWidth - 150)}px`;
      tooltip.current.style.top = `${Math.min(value.y + 18, window.innerHeight - 110)}px`;
    }
    setHovered(current => current?.index === value?.index ? current : value);
  }, []);
  useEffect(() => {
    if (active) document.title = 'OVEN SAUNA — Image Tube';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => { motion.current.reduced = reduced.matches; transition.current.reduced = reduced.matches; };
    const syncVisibility = () => setHidden(document.hidden);
    syncMotion();
    reduced.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    const surface = window;
    const wheel = (event: WheelEvent) => {
      if (!active || event.ctrlKey || unavailable) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      move(event.deltaY * unit);
      setHovered(null);
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => {
      reduced.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
      surface.removeEventListener('wheel', wheel);
    };
  }, [active, unavailable, move]);
  const pause = () => {
    const next = !paused;
    setPaused(next);
    motion.current.paused = next;
    if (next) motion.current.velocity = 0;
  };
  return <div className={`sauna-tube tube-embedded${active ? '' : ' tube-inactive'}${unavailable ? ' tube-static' : ''}`} ref={root} aria-hidden={!active} inert={!active}>
    <div className="tube-chrome-shade" aria-hidden="true" />
    <h1 className="tube-sr-only">OVEN SAUNA — Graphic archive</h1>
    <div className="tube-stage" role="region" aria-label="OVEN SAUNA 그래픽 튜브. 스크롤 또는 위아래 방향키로 이동합니다." tabIndex={0}
      onKeyDown={event => {
        if (unavailable) return;
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', ' '].includes(event.key)) event.preventDefault();
        if (event.key === 'ArrowDown' || event.key === 'PageDown') move(event.key === 'PageDown' ? 300 : 120);
        if (event.key === 'ArrowUp' || event.key === 'PageUp') move(event.key === 'PageUp' ? -300 : -120);
        if (event.key === 'Home') transition.current.target = 0;
        if (event.key === ' ') pause();
      }}
      onPointerDown={event => {
        if (event.button !== 0 || unavailable) return;
        if (!event.isPrimary) { drag.current = null; return; }
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        setHovered(null);
      }}
      onPointerMove={event => {
        pointer.current = { x: event.clientX / window.innerWidth * 2 - 1, y: event.clientY / window.innerHeight * 2 - 1 };
        if (drag.current?.id !== event.pointerId) return;
        move((drag.current.y - event.clientY) * 2);
        if (transition.current.target === 0) motion.current.angle += (event.clientX - drag.current.x) * .003;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onPointerLeave={() => { setHovered(null); pointer.current = { x: 0, y: 0 }; }}>
      {unavailable ? <GalleryFallback onReady={onFallback} /> : <TubeBoundary fallback={<GalleryFallback onReady={onFallback} />}>
        <Canvas camera={{ position: [0, 0, 6.5], fov: 50 }} dpr={[1, 1.5]} frameloop={hidden || !active ? 'never' : 'always'}
          gl={{ alpha: true, antialias: true }} fallback="OVEN SAUNA 그래픽 갤러리"
          onCreated={({ gl, camera }) => { gl.setClearColor(0x000000, 0); camera.lookAt(0, 0, 0); }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[3, 4, 6]} intensity={2} />
          <Suspense fallback={null}>
            <ArtworkTube motion={motion} transition={transition} onHover={onHover} onReady={onReady} />
            <SaunaLogo motion={motion} pointer={pointer} transition={transition} />
          </Suspense>
        </Canvas>
      </TubeBoundary>}
      {!ready && <img className="tube-loading-logo" src="/brand/oven-sauna-logo.svg" alt="OVEN SAUNA 그래픽 불러오는 중" />}
    </div>
    {hovered && <div className="tube-tooltip" ref={tooltip} style={{ left: Math.min(hovered.x + 18, window.innerWidth - 150), top: Math.min(hovered.y + 18, window.innerHeight - 110) }}>
      <span>{String(hovered.index + 1).padStart(2, '0')} / {String(tubeArtworks.length).padStart(2, '0')}</span><strong>{tubeArtworks[hovered.index].title}</strong>
    </div>}
    <div className="tube-bottom-shade" aria-hidden="true" />
    {!unavailable && <div className="tube-instruction"><span aria-hidden="true">↓</span><p>스크롤하면 OVEN SAUNA의 이야기가 시작됩니다.</p></div>}
    {unavailable && <button className="tube-continue" onClick={onComplete}>OVEN SAUNA 이야기 보기 ↓</button>}
    {!unavailable && <button className="tube-pause" onClick={pause} aria-pressed={paused} aria-label={paused ? '자동 회전 재생' : '자동 회전 일시정지'}>{paused ? 'Play' : 'Pause'}</button>}
  </div>;
}
