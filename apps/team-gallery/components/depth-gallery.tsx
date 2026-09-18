'use client';
/* oxlint-disable next/no-img-element -- Preserve exact local Figma crop transforms. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import IntroHeatBands from './intro-heat-bands';
import { createFrameTextReveals } from '@/lib/text-reveal.mjs';
import { fitGalleryFrame } from '@/lib/gallery-layout.mjs';
import {
  FRAME_IDS,
  GalleryMotion,
  backgroundWeights,
  frameOpacity,
  frameProjection,
  damp,
} from '@/lib/gallery-motion.mjs';

// Match the labels in the supplied portrait artwork, in member-frame order.
const MEMBERS = [
  {
    id: 'kim-gwanu',
    name: '김관우',
    surname: 'KIM',
    givenName: 'GWANU',
    role: 'PROJECT MANAGER',
  },
  {
    id: 'jeoung-jinseo',
    name: '정진서',
    surname: 'JEOUNG',
    givenName: 'JINSEO',
    role: 'UX / BRANDING',
    description: [
      [
        '굽네의 새로운 모습을 발견하고,',
        'OVEN SAUNA만의 이야기와 정체성을 만듭니다.',
      ],
      [
        '브랜드의 첫인상부터 경험 이후의 기억까지,',
        '일관된 인상으로 이어지는 디자인을 고민합니다.',
      ],
    ],
  },
  {
    id: 'jeong-junyong',
    name: '정준용',
    surname: 'JEONG',
    givenName: 'JUN-YONG',
    role: 'GRAPHIC / INTERACTION',
    description: [
      ['사우나의 열기와 굽네의 에너지를 그래픽과', '움직임으로 표현합니다.'],
      [
        '색과 형태, 화면의 전환을 통해 OVEN SAUNA의',
        '분위기를 감각적으로 전달합니다.',
      ],
    ],
  },
  {
    id: 'yoon-ga-won',
    name: '윤가원',
    surname: 'YOON',
    givenName: 'GA-WON',
    role: 'PRODUCT DESIGN',
    description: [
      ['OVEN SAUNA의 사우나 팔찌를 디자인합니다.'],
      [
        '손목에 편안하게 착용하면서 브랜드의 개성도 느낄 수 있는 팔찌를 고민합니다.',
      ],
    ],
  },
  {
    id: 'choi-eun-seo',
    name: '최은서',
    surname: 'CHOI',
    givenName: 'EUN-SEO',
    role: 'PRODUCT DESIGN',
    description: [
      ['브랜드의 개성을 패키지의 형태와 그래픽으로 표현합니다.'],
      [
        '소재와 구조, 제품을 열어보는 과정까지 고려해',
        '오븐 사우나만의 패키지를 디자인합니다.',
      ],
    ],
  },
] as const;

function RevealText({
  as: Tag = 'p',
  kind,
  className,
  children,
}: {
  as?: 'p' | 'h1' | 'h2';
  kind: 'title' | 'role' | 'body' | 'meta';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className} data-reveal={kind}>
      <span data-reveal-source>{children}</span>
    </Tag>
  );
}
function Description({ memberIndex }: { memberIndex?: number }) {
  const member = memberIndex ? MEMBERS[memberIndex - 1] : undefined;
  if (member && 'description' in member) {
    return (
      <div className="description member-description">
        {member.description.map((lines, paragraphIndex) => (
          <RevealText kind="body" key={paragraphIndex}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && (
                  <>
                    <br className="profile-copy-break" />{' '}
                  </>
                )}
                {line}
              </span>
            ))}
          </RevealText>
        ))}
      </div>
    );
  }
  if (memberIndex === 1) {
    return (
      <div className="description figma-description">
        <RevealText kind="body">
          다섯 명의 아이디어를 하나의 방향으로 연결하며,
          <br /> OVEN SAUNA의 기획과 실행을 이끕니다.
        </RevealText>
        <RevealText kind="body">
          팀의 다양한 시선이 하나의 브랜드 경험으로 완성되도록 프로젝트의 흐름과
          디테일을 조율합니다.
        </RevealText>
      </div>
    );
  }
  return (
    <div className="description">
      <RevealText kind="body">
        TEAM KN0T는 홍익대학교 시각디자인과 3명, 산업디자인과 2명으로 구성된
        융합 디자인 팀입니다.
      </RevealText>
      <RevealText kind="body">
        굽네치킨과 함께 다섯 명의 서로 다른 강점과 열정을 모아 새로운 브랜드
        경험을 만들어갑니다.
      </RevealText>
    </div>
  );
}
function IntroCopy() {
  return (
    <div className="intro-copy">
      <RevealText kind="role" className="eyebrow">
        GOOBNE X HONGIK
      </RevealText>
      <RevealText as="h1" kind="title">
        TEAM KNOT
      </RevealText>
      <Description />
    </div>
  );
}
function IntroDeck() {
  return (
    <div className="intro-carousel" aria-hidden="true">
      <div className="intro-carousel-track">
        {[0, 1].map((repeat) => (
          <div className="intro-carousel-set" key={repeat}>
            {MEMBERS.map((member) => (
              <div className="team-card" key={member.id}>
                <img
                  src={`/assets/profiles/${member.id}.webp`}
                  width={1440}
                  height={1800}
                  alt=""
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function MemberPhoto({ index }: { index: number }) {
  const member = MEMBERS[index - 1];
  return (
    <div className="portrait">
      <img
        src={`/assets/profiles/${member.id}.webp`}
        width={1440}
        height={1800}
        alt={`${member.name} — ${member.role} 프로필`}
        draggable={false}
      />
    </div>
  );
}
function MemberCopy({ index }: { index: number }) {
  const member = MEMBERS[index - 1];
  return (
    <div className={`member-copy${index > 1 ? ' member-copy-personal' : ''}`}>
      <RevealText kind="role" className="eyebrow">
        {member.role}
      </RevealText>
      <RevealText as="h2" kind="title">
        {member.surname}
        <br /> {member.givenName}
      </RevealText>
      <Description memberIndex={index} />
    </div>
  );
}
function MemberMeta({ index }: { index: number }) {
  const member = MEMBERS[index - 1];
  if (index === 1) {
    return (
      <div className="member-meta">
        <RevealText kind="meta">
          <img
            src="/assets/member-header/kim-meta.svg"
            width={205}
            height={54}
            alt="01 — VISUAL COMMUNICATION"
            draggable={false}
          />
        </RevealText>
      </div>
    );
  }
  return (
    <div className="member-meta">
      <RevealText kind="meta">{String(index).padStart(2, '0')}</RevealText>
      <RevealText kind="meta">{member.role}</RevealText>
    </div>
  );
}
function Rolling({ children }: { children: string }) {
  return (
    <span className="rolling">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}

// Outlined exports preserve Figma's Strong Regular letterforms on every device.
function HeaderLabel({
  asset,
  label,
  width,
  height,
}: {
  asset: string;
  label: string;
  width: number;
  height: number;
}) {
  return (
    <img
      className="member-header-label"
      src={`/assets/member-header/${asset}.svg`}
      alt={label}
      width={width}
      height={height}
      style={{ width: `${width / 15}em`, height: `${height / 15}em` }}
      draggable={false}
    />
  );
}

export default function DepthGallery() {
  const viewportRef = useRef<HTMLElement>(null),
    stageRef = useRef<HTMLDivElement>(null),
    memberHeaderRef = useRef<HTMLElement>(null);
  const motionRef = useRef(new GalleryMotion());
  const [active, setActive] = useState(0),
    [dragging, setDragging] = useState(false),
    [touched, setTouched] = useState(false);
  useEffect(() => {
    const viewport = viewportRef.current!,
      stage = stageRef.current!,
      motion = motionRef.current;
    const frames = Array.from(
      stage.querySelectorAll<HTMLElement>('.depth-frame'),
    );
    const backgrounds = Array.from(
      viewport.querySelectorAll<HTMLElement>('.mood'),
    );
    const heroHeader = stage.querySelector<HTMLElement>('.hero-header')!;
    const memberHeader = memberHeaderRef.current!;
    const saunaCanvas =
      viewport.querySelector<HTMLCanvasElement>('.sauna-steam')!;
    let sauna: ReturnType<
      typeof import('@/lib/sauna-steam.mjs').createSaunaSteam
    > | null = null;
    let disposed = false;
    const media = frames.map((frame) =>
      frame.querySelector<HTMLElement>('.frame-media')!,
    );
    const opacities = [1, 0, 0, 0, 0, 0];
    let breathCurrent = 0,
      driftCurrent = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = reduce.matches,
      width = 1440,
      height = 1024,
      scale = 1,
      environmentWidth = 1440,
      environmentHeight = 1024,
      activeIndex = 0,
      activePointer: number | null = null,
      frameId = 0,
      lastTime = 0;
    let pointer = { x: 0, y: 0 };
    const currentPointer = { x: 0, y: 0 };
    const textReveals = createFrameTextReveals(frames, () => scale);
    let focal = 1236.077,
      textLayout = '';
    const resize = () => {
      const bounds = viewport.getBoundingClientRect();
      const style = getComputedStyle(viewport);
      const layout = fitGalleryFrame(bounds.width, bounds.height, {
        left: parseFloat(style.paddingLeft),
        right: parseFloat(style.paddingRight),
        top: parseFloat(style.paddingTop),
        bottom: parseFloat(style.paddingBottom),
      });
      ({ width, height, scale } = layout);
      stage.style.width = `${width}px`;
      stage.style.height = `${height}px`;
      stage.style.transform = `translate3d(${layout.left}px,${layout.top}px,0) scale(${scale})`;
      stage.dataset.layoutReady = 'true';
      stage.dataset.format = layout.format;
      viewport.dataset.format = layout.format;
      viewport.style.setProperty('--frame-x', `${layout.left}px`);
      viewport.style.setProperty('--frame-y', `${layout.top}px`);
      viewport.style.setProperty('--frame-scale', `${scale}`);
      viewport.style.setProperty('--frame-width', `${width}px`);
      viewport.style.setProperty('--frame-height', `${height}px`);
      focal = height / (2 * Math.tan(Math.PI / 8));
      environmentWidth = bounds.width;
      environmentHeight = bounds.height;
      sauna?.resize(environmentWidth, environmentHeight);
      const nextTextLayout = `${width}:${height}:${scale}`;
      if (textLayout && textLayout !== nextTextLayout) textReveals.resize();
      textLayout = nextTextLayout;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();
    textReveals.update(motion.current, reduced);
    void import('@/lib/sauna-steam.mjs')
      .then(({ createSaunaSteam }) => {
        if (disposed) return;
        try {
          sauna = createSaunaSteam(saunaCanvas);
          sauna.resize(environmentWidth, environmentHeight);
        } catch {
          // Keep the supplied frames readable if WebGL is unavailable.
          saunaCanvas.hidden = true;
        }
      })
      .catch(() => {
        saunaCanvas.hidden = true;
      });
    // PerspectiveCamera's projection equations are applied directly to DOM layers.
    const animate = (time: number) => {
      const dt = Math.min((time - (lastTime || time - 16.67)) / 1000, 0.05);
      lastTime = time;
      const progress = motion.tick(dt),
        nextActive = Math.round(progress);
      if (nextActive !== activeIndex) {
        activeIndex = nextActive;
        setActive(nextActive);
      }
      textReveals.update(progress, reduced);
      currentPointer.x = damp(currentPointer.x, pointer.x, 0.08, dt);
      currentPointer.y = damp(currentPointer.y, pointer.y, 0.08, dt);
      breathCurrent = damp(
        breathCurrent,
        Math.min((Math.abs(motion.velocity) / 1.5) * 1.1, 1),
        0.14,
        dt,
      );
      driftCurrent = damp(driftCurrent, motion.velocity / 1.5, 0.05, dt);
      frames.forEach((frame, index) => {
        const targetOpacity = frameOpacity(index, progress);
        opacities[index] = damp(opacities[index], targetOpacity, 0.14, dt);
        if (
          !motion.moving &&
          Math.abs(opacities[index] - targetOpacity) < 0.001
        )
          opacities[index] = targetOpacity;
        const projection = frameProjection(index, progress);
        const opacity = opacities[index] * projection.visibility,
          layer = media[index];
        frame.style.zIndex = `${10 - index}`;
        frame.style.opacity = `${opacity}`;
        frame.style.visibility = opacity < 0.001 ? 'hidden' : 'visible';
        frame.style.pointerEvents = index === nextActive ? 'auto' : 'none';
        frame.inert = index !== nextActive;
        frame.setAttribute('aria-hidden', String(index !== nextActive));
        if (reduced) {
          layer.style.transform = 'none';
          layer.style.visibility = 'inherit';
          return;
        }
        const zoom = projection.zoom,
          influence = opacity * (1 + index * 0.05);
        const envelope = Math.min(Math.abs(motion.velocity) / 1.5, 1);
        const worldUnit = focal / 5;
        let x = currentPointer.x * 0.16 * worldUnit * influence * envelope,
          y =
            currentPointer.y * 0.08 * worldUnit * influence * envelope +
            driftCurrent * 0.05 * worldUnit * envelope;
        // Use the same bounded projection for position and scale.
        x *= zoom;
        y *= zoom;
        layer.style.visibility = 'inherit';
        layer.style.transform = `translate3d(${x}px,${y}px,0) scale(${Math.min(Math.max(zoom, 0.001), 40) * (1 + breathCurrent * opacity * envelope * 0.03)}) rotateX(${-currentPointer.y * breathCurrent * opacity * envelope * 2.578}deg) rotateY(${currentPointer.x * breathCurrent * opacity * envelope * 2.578}deg)`;
        frame.style.zIndex = `${10 - index}`;
      });
      const headerBlend = Math.min(1, progress);
      heroHeader.style.opacity = `${1 - headerBlend}`;
      heroHeader.style.visibility = headerBlend >= 1 ? 'hidden' : 'visible';
      heroHeader.inert = headerBlend > 0.5;
      memberHeader.style.opacity = `${headerBlend}`;
      memberHeader.style.visibility = headerBlend <= 0 ? 'hidden' : 'visible';
      memberHeader.inert = headerBlend <= 0.5;
      const weights = backgroundWeights(progress);
      backgrounds.forEach((background, index) => {
        background.style.opacity = `${weights[index]}`;
        background.style.visibility = weights[index] > 0 ? 'visible' : 'hidden';
      });
      sauna?.update(progress, currentPointer, time, reduced);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || motion.drag) return;
      event.preventDefault();
      const raw =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      motion.wheel(
        raw *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? viewport.clientHeight
              : 1),
      );
      setTouched(true);
    };
    const down = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        activePointer !== null ||
        (event.target as HTMLElement).closest('button,a,[data-no-drag]')
      )
        return;
      activePointer = event.pointerId;
      viewport.setPointerCapture(event.pointerId);
      motion.begin(event.clientX, event.clientY, event.timeStamp);
      setDragging(true);
    };
    const move = (event: PointerEvent) => {
      const bounds = viewport.getBoundingClientRect();
      pointer = {
        x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        y: ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
      };
      if (!motion.drag || event.pointerId !== activePointer) return;
      motion.move(event.clientX, event.clientY);
      if (motion.drag.axis) setTouched(true);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return;
      activePointer = null;
      motion.end(event.type !== 'pointerup');
      if (viewport.hasPointerCapture(event.pointerId))
        viewport.releasePointerCapture(event.pointerId);
      setDragging(false);
    };
    const leave = () => {
      pointer = { x: 0, y: 0 };
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest('input,textarea,select') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const next = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key),
        previous = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key);
      if (!next && !previous && !['Home', 'End', 'Escape'].includes(event.key))
        return;
      event.preventDefault();
      motion.goTo(
        event.key === 'Home' || event.key === 'Escape'
          ? 0
          : event.key === 'End'
            ? 5
            : Math.round(motion.target) + (next ? 1 : -1),
      );
      setTouched(true);
    };
    const preference = () => {
      reduced = reduce.matches;
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    viewport.addEventListener('pointerdown', down);
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
    viewport.addEventListener('lostpointercapture', up);
    viewport.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', keyboard);
    reduce.addEventListener('change', preference);
    return () => {
      disposed = true;
      sauna?.dispose();
      textReveals.dispose();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      viewport.removeEventListener('wheel', wheel);
      viewport.removeEventListener('pointerdown', down);
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerup', up);
      viewport.removeEventListener('pointercancel', up);
      viewport.removeEventListener('lostpointercapture', up);
      viewport.removeEventListener('pointerleave', leave);
      window.removeEventListener('keydown', keyboard);
      reduce.removeEventListener('change', preference);
    };
  }, []);
  const goTo = (index: number) => {
    motionRef.current.goTo(index);
    setTouched(true);
  };
  return (
    <main
      ref={viewportRef}
      className={`gallery-viewport ${dragging ? 'is-dragging' : ''}`}
      data-intro-active={active === 0}
      aria-label="TEAM KN0T 깊이 갤러리"
      aria-roledescription="캐러셀"
    >
      <div className="gallery-environment" aria-hidden="true">
        <div className="moods" aria-hidden="true">
          <div className="mood mood-intro">
            <div className="intro-heat-frame">
              <IntroHeatBands active={active === 0} />
            </div>
            <div className="intro-vapor">
              <img src="/assets/intro-mist.png" alt="" draggable={false} />
              <img src="/assets/intro-mist.png" alt="" draggable={false} />
            </div>
          </div>
          {['left', 'right', 'left', 'right', 'left'].map((variant, i) => (
            <div
              key={i}
              className="mood mood-figma"
              data-layout={variant}
              style={{
                backgroundImage: `url(/assets/revised-background-${variant}.png)`,
              }}
            />
          ))}
        </div>
      </div>
      <div ref={stageRef} className="gallery-stage">
        <div className="depth-world">
          {FRAME_IDS.map((id: string, index: number) => (
            <section
              key={id}
              className={`depth-frame ${index === 0 ? 'intro-frame' : index % 2 ? 'member-frame photo-left' : 'member-frame photo-right'}`}
              data-figma-node={id}
              aria-label={
                index === 0
                  ? '1 / 6 — TEAM KN0T 소개'
                  : `${index + 1} / 6 — ${MEMBERS[index - 1].name}`
              }
              aria-roledescription="슬라이드"
              aria-hidden={index !== 0}
            >
              <div className="frame-media">
                {index === 0 ? (
                  <IntroDeck />
                ) : (
                  <div className="member-layout">
                    <MemberPhoto index={index} />
                  </div>
                )}
              </div>
              <div className="frame-copy">
                {index === 0 ? (
                  <IntroCopy />
                ) : (
                  <div className="member-layout">
                    <MemberCopy index={index} />
                    <MemberMeta index={index} />
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
        <header className="site-header hero-header" data-no-drag>
          <a
            className="brand"
            href="https://oven-sauna-ddp.harry040904.chatgpt.site/"
            aria-label="GOOBNE OVEN SAUNA 히어로로"
          >
            <img
              className="brand-mark"
              src="/assets/logo.svg"
              alt=""
              width="42"
              height="39"
            />
            <span className="brand-type">
              <strong>GOOBNE OVEN SAUNA</strong>
              <small>2026 DDP YOUNG DESIGNER</small>
            </span>
          </a>
          <nav className="nav" aria-label="메인 메뉴">
            <button
              className="active"
              onClick={() => goTo(0)}
              aria-current="page"
            >
              <Rolling>HOME</Rolling>
            </button>
            <button onClick={() => goTo(1)}>
              <Rolling>ABOUT</Rolling>
            </button>
            <a href="https://oven-sauna-ddp.harry040904.chatgpt.site/#profile">
              <Rolling>PROJECT</Rolling>
            </a>
            <button disabled title="공간 모델링 페이지 연결 준비 중">
              <Rolling>DEVICES</Rolling>
            </button>
          </nav>
          <button className="contact pill" disabled title="연락처 연결 준비 중">
            <Rolling>Contact US</Rolling>
          </button>
        </header>
        <footer
          className={`gallery-controls ${touched ? 'has-travelled' : ''}`}
          data-no-drag
        >
          <button
            className="drag-instruction"
            onClick={() => goTo(active === 5 ? 0 : active + 1)}
            aria-label={
              active === 5 ? '팀 소개 처음으로' : '다음 화면으로 이동'
            }
          >
            <span aria-hidden="true">↔</span>
            {active === 5 ? 'BACK TO TEAM' : 'DRAG TO EXPLORE'}
          </button>
          <div className="waypoints" aria-label="화면 선택">
            {FRAME_IDS.map((id: string, index: number) => (
              <button
                key={id}
                className={index === active ? 'active' : ''}
                onClick={() => goTo(index)}
                aria-label={`${index + 1}번째 화면으로 이동`}
                aria-current={index === active ? 'step' : undefined}
              >
                <span />
              </button>
            ))}
            <span className="frame-count">
              {String(active + 1).padStart(2, '0')} / 06
            </span>
          </div>
        </footer>
        <header
          ref={memberHeaderRef}
          className="member-layout member-header"
          data-no-drag
        >
          <div className="member-header-content">
            <div className="member-header-row">
              <div className="member-header-left">
                <button className="team-caption" onClick={() => goTo(0)}>
                  <HeaderLabel
                    asset="team"
                    label="We are team kn0t DDP YOUNG DESIGNERS"
                    width={248}
                    height={23}
                  />
                </button>
                <nav className="member-pages" aria-label="멤버 프레임 선택">
                  {[1, 2, 3, 4, 5].map((index) => (
                    <button
                      key={index}
                      onClick={() => goTo(index)}
                      aria-label={`${MEMBERS[index - 1].name} 소개로 이동`}
                      aria-current={active === index ? 'page' : undefined}
                    >
                      <HeaderLabel
                        asset={String(index).padStart(2, '0')}
                        label={String(index).padStart(2, '0')}
                        width={index === 1 ? 14 : 16}
                        height={23}
                      />
                    </button>
                  ))}
                </nav>
              </div>
              <p className="team-caption-right">
                <HeaderLabel
                  asset="brand"
                  label="GOOBNE X HONGIK"
                  width={109}
                  height={23}
                />
              </p>
            </div>
            <p className="team-caption-tail">
              <HeaderLabel
                asset="sauna"
                label="OVEN SAUNA"
                width={78}
                height={23}
              />
            </p>
          </div>
        </header>
      </div>
      <canvas className="sauna-steam" aria-hidden="true" />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {active === 0
          ? 'TEAM KN0T 소개. 드래그하거나 방향키로 이동하세요.'
          : `팀 소개 ${active} / 5. ${MEMBERS[active - 1].role}, ${MEMBERS[active - 1].name}.`}
      </p>
    </main>
  );
}
