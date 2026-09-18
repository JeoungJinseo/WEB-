"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { createDisplacement, type Displacement } from "./displacement";
import HeatAtmosphere from "./heat-atmosphere";
import { values, type Value } from "./values";
import styles from "./oven-sauna.module.css";

const subscribeMotion = (callback: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const readMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotion = () => false;

// Start with the lightweight rendering path, including during hydration.
const enhancedQuery = "(min-width: 1025px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const subscribeEnhanced = (callback: () => void) => {
  const query = window.matchMedia(enhancedQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const readEnhanced = () => window.matchMedia(enhancedQuery).matches;

function galleryGeometry(track: HTMLDivElement, container: HTMLDivElement) {
  const width = parseFloat(getComputedStyle(track.children[0]).width);
  return {
    width,
    step: width + (parseFloat(getComputedStyle(track).columnGap) || 0),
    inset: parseFloat(getComputedStyle(container).paddingLeft) || 0,
    viewportWidth: container.clientWidth,
  };
}

function DisplacementPhoto({ value, active }: { value: Value; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<Displacement | null>(null);
  const progress = useRef(0);
  const frame = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const photo = new window.Image();
    const initialize = () => {
      if (cancelled) return;
      surface.current?.dispose();
      surface.current = createDisplacement(element, photo, value.cropOffset, value.restingShade);
      if (surface.current) {
        surface.current.draw(progress.current);
        setReady(true);
      }
    };
    photo.onload = () => {
      initialize();
      observer = new ResizeObserver(() => surface.current?.draw(progress.current));
      observer.observe(element);
    };
    // Offscreen duplicates do not need their own GPU texture until first visible.
    const visible = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      visible.disconnect();
      photo.src = value.image;
    }, { rootMargin: "100px" });
    visible.observe(element);
    const onLost = (event: Event) => { event.preventDefault(); setReady(false); };
    element.addEventListener("webglcontextlost", onLost);
    element.addEventListener("webglcontextrestored", initialize);
    return () => {
      cancelled = true;
      photo.onload = null;
      visible.disconnect();
      observer?.disconnect();
      cancelAnimationFrame(frame.current);
      element.removeEventListener("webglcontextlost", onLost);
      element.removeEventListener("webglcontextrestored", initialize);
      surface.current?.dispose(true);
      surface.current = null;
    };
  }, [value]);

  useEffect(() => {
    cancelAnimationFrame(frame.current);
    const target = active ? 1 : 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      progress.current += (target - progress.current) * (1 - Math.exp(-dt * (active ? 6.5 : 5.2)));
      const done = Math.abs(target - progress.current) < 0.002;
      if (done) progress.current = target;
      surface.current?.draw(progress.current);
      if (!done) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [active]);

  return <canvas ref={canvas} className={styles.displacement} data-ready={ready} aria-hidden="true" />;
}

function ValueCard({ value, index, active, enhanced, onEnter, onLeave, onFocus, onBlur, onToggle }: {
  value: Value;
  index: number;
  active: boolean;
  enhanced: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onToggle: () => void;
}) {

  return (
    <div className={styles.cardSlot} data-slot={index}>
      <button
        className={styles.card}
        data-active={active}
        data-card={value.id}
        data-copy={Math.floor(index / values.length)}
        type="button"
        aria-label={`Value ${value.number} — ${value.title}`}
        aria-expanded={active}
        aria-controls={`value-description-${index}`}
        tabIndex={index < values.length ? 0 : -1}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") onEnter(); }}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--tilt-x", "0deg");
          event.currentTarget.style.setProperty("--tilt-y", "0deg");
          if (event.pointerType === "mouse") onLeave();
        }}
        onPointerMove={(event) => {
          if (!enhanced || event.pointerType !== "mouse") return;
          const box = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - (event.clientY - box.top) / box.height) * 2.5}deg`);
          event.currentTarget.style.setProperty("--tilt-y", `${((event.clientX - box.left) / box.width - 0.5) * 3}deg`);
        }}
        onFocus={(event) => { if (event.target.matches(":focus-visible")) onFocus(); }}
        onBlur={onBlur}
        onClick={onToggle}
      >
        <span className={styles.photoFallback} data-recovery={value.id === "recovery"} aria-hidden="true">
          <Image src={value.image} alt="" fill sizes="(max-width: 600px) 82vw, 43vw" unoptimized priority={index < 3} />
        </span>
        {enhanced && <DisplacementPhoto value={value} active={active} />}
        <span className={styles.cardBadge}>Value {value.number}</span>
        <span className={styles.cardHeading}>
          <span className={styles.cardLead}>{active ? value.activeLead : value.lead}</span>
          <span className={styles.cardTitle}>{value.title}</span>
        </span>
        <span id={`value-description-${index}`} className={styles.cardDescription} aria-hidden={!active}>
          {value.description}
        </span>
      </button>
    </div>
  );
}

export default function OvenSauna() {
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
  const enhanced = useSyncExternalStore(subscribeEnhanced, readEnhanced, serverMotion);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activeNav, setActiveNav] = useState("HOME");
  const [notice, setNotice] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const seek = useRef(0);
  const drag = useRef({ active: false, pointerId: -1, startX: 0, startY: 0, previousX: 0, lastTime: 0, velocity: 0, moved: false });
  const suppressClick = useRef(false);
  const suppressHover = useRef(false);
  const resumeAfter = useRef(0);
  const active = focused ?? hovered ?? selected;
  const state = useRef({ active, paused, reduced, enhanced });
  const wake = useRef(() => {});
  const setCardHover = useCallback((index: number | null) => {
    if (!drag.current.active && !suppressHover.current) setHovered(index);
  }, []);

  useEffect(() => {
    state.current = { active, paused, reduced, enhanced };
    if (!enhanced) {
      for (const slot of rail.current?.children ?? []) (slot as HTMLElement).style.removeProperty("transform");
    }
    wake.current();
  }, [active, paused, reduced, enhanced]);

  useEffect(() => {
    const track = rail.current;
    const container = viewport.current;
    if (!track || !container) return;
    const slots = Array.from(track.children) as HTMLElement[];
    let raf = 0;
    let timer = 0;
    let translatedOffset = NaN;
    let last = 0;
    let elapsed = 0;
    let speed = 0;
    let step = 0;
    let cycle = 0;
    let geometry = { width: 0, step: 0, inset: 0, viewportWidth: 0 };
    let onScreen = true;
    let hidden = document.hidden;
    let initialized = false;
    const measure = () => {
      const previous = geometry;
      geometry = galleryGeometry(track, container);
      const { width, inset, viewportWidth } = geometry;
      step = geometry.step;
      cycle = step * values.length;
      if (!initialized) {
        // Compact layouts show the whole first card inside the safe-area inset.
        offset.current = inset ? 0 : width * (127 / 618.324);
        initialized = true;
      } else if (previous.step) {
        if (state.current.active !== null) {
          // Keep the open card fully visible when the phone rotates.
          offset.current = state.current.active * step + inset - (viewportWidth - width) / 2;
          seek.current = 0;
        } else {
          const position = (offset.current - previous.inset + previous.viewportWidth / 2) / previous.step;
          offset.current = position * step + inset - viewportWidth / 2;
          seek.current *= step / previous.step;
        }
      }
      track.style.transform = `translate3d(${-offset.current}px,0,0)`;
      translatedOffset = offset.current;
    };
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.04) : 0;
      last = now;
      const floating = state.current.enhanced && !state.current.reduced && !state.current.paused && !(drag.current.moved && drag.current.active);
      if (floating) elapsed += dt;
      const stop = state.current.paused || state.current.reduced || state.current.active !== null || drag.current.active || now < resumeAfter.current || Math.abs(seek.current) > 0.1;
      speed += ((stop ? 0 : 30) - speed) * (1 - Math.exp(-dt * (stop ? 12 : 2.2)));
      if (stop && speed < 0.03) speed = 0;
      if (!drag.current.active && now >= resumeAfter.current && Math.abs(seek.current) <= 0.1) offset.current += speed * dt;
      const amount = state.current.reduced ? seek.current : seek.current * (1 - Math.exp(-dt * 7));
      offset.current += amount;
      seek.current -= amount;
      if (Math.abs(seek.current) < 0.1) seek.current = 0;
      if (cycle && state.current.active === null) {
        offset.current = ((offset.current % cycle) + cycle) % cycle;
      }
      if (offset.current !== translatedOffset) {
        track.style.transform = `translate3d(${-offset.current}px, 0, 0)`;
        translatedOffset = offset.current;
      }
      if (floating) {
        slots.forEach((slot, index) => {
          const phase = (index % values.length) * 1.7;
          const y = Math.sin(elapsed * 0.56 + phase) * 5;
          const rotation = Math.sin(elapsed * 0.32 + phase) * 0.28;
          slot.style.transform = `translate3d(0, ${y}px, 0) rotate(${rotation}deg)`;
        });
      }
      if (hidden || !onScreen) return;
      if (floating || !stop || speed > 0 || Math.abs(seek.current) > 0.1) {
        raf = requestAnimationFrame(tick);
      } else if (!state.current.paused && !state.current.reduced && state.current.active === null && !drag.current.active && now < resumeAfter.current) {
        timer = window.setTimeout(resume, resumeAfter.current - now);
      }
    };
    const resume = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      last = 0;
      if (!hidden && onScreen) raf = requestAnimationFrame(tick);
    };
    wake.current = resume;
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; resume(); }, { rootMargin: "120px" });
    observer.observe(container);
    const resize = new ResizeObserver(() => { measure(); resume(); });
    resize.observe(container);
    // Height-only resizing can change card dimensions without changing the rail viewport width.
    resize.observe(slots[0]);
    const visibility = () => { hidden = document.hidden; resume(); };
    document.addEventListener("visibilitychange", visibility);
    measure();
    resume();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      wake.current = () => {};
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const focusCard = (index: number) => {
    suppressHover.current = false;
    state.current.active = index;
    setHovered(null);
    setSelected(null);
    setFocused(index);
    const track = rail.current;
    const container = viewport.current;
    if (!track || !container) return;
    // Keep keyboard focus fully visible, including after the automatic loop wraps.
    const { width, step, inset, viewportWidth } = galleryGeometry(track, container);
    offset.current = index * step + inset - (viewportWidth - width) / 2;
    seek.current = 0;
    track.style.transform = `translate3d(${-offset.current}px,0,0)`;
  };
  const move = (direction: number) => {
    const track = rail.current;
    const container = viewport.current;
    if (!track || !container) return;
    setSelected(null);
    setHovered(null);
    setFocused(null);
    state.current.active = null;
    resumeAfter.current = performance.now() + 1600;
    const { step } = galleryGeometry(track, container);
    seek.current += direction * step;
    wake.current();
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || drag.current.active) return;
    // Keep a mouse drag from starting native text/image dragging or moving focus.
    if (event.pointerType === "mouse") event.preventDefault();
    suppressClick.current = false;
    drag.current = { active: true, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, previousX: event.clientX, lastTime: event.timeStamp, velocity: 0, moved: false };
    seek.current = 0;
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture.active) {
      // A new intentional pointer movement restores hover after a drag.
      if (event.pointerType === "mouse" && (event.movementX || event.movementY)) {
        suppressHover.current = false;
        const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-slot]");
        if (slot) {
          setFocused(null);
          setHovered(Number(slot.dataset.slot));
        }
      }
      return;
    }
    if (event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved) {
      // A vertical touch gesture stays a normal page scroll.
      if (event.pointerType !== "mouse" && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        gesture.active = false;
        wake.current();
        return;
      }
      if (Math.abs(dx) < 8) return;
      gesture.moved = true;
      suppressClick.current = true;
      suppressHover.current = true;
      setDragging(true);
      setHovered(null);
      setSelected(null);
      setFocused(null);
      state.current.active = null;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const delta = event.clientX - gesture.previousX;
    const dt = Math.max(8, event.timeStamp - gesture.lastTime) / 1000;
    gesture.velocity = gesture.velocity * 0.35 + (-delta / dt) * 0.65;
    offset.current -= delta;
    gesture.previousX = event.clientX;
    gesture.lastTime = event.timeStamp;
    // Follow the hand immediately; settling continues in the shared animation loop.
    if (rail.current) rail.current.style.transform = `translate3d(${-offset.current}px,0,0)`;
  };
  const finishDrag = useCallback((pointerId: number, cancelled = false, releasedAt = performance.now()) => {
    const gesture = drag.current;
    if (!gesture.active || gesture.pointerId !== pointerId) return;
    gesture.active = false;
    setDragging(false);
    if (gesture.moved && rail.current && viewport.current) {
      const track = rail.current;
      const { width, step, inset, viewportWidth } = galleryGeometry(track, viewport.current);
      const center = (viewportWidth - width) / 2 - inset;
      const velocity = cancelled || state.current.reduced || releasedAt - gesture.lastTime > 100 ? 0 : Math.max(-1800, Math.min(1800, gesture.velocity));
      const travel = Math.max(-step * 0.65, Math.min(step * 0.65, velocity * 0.16));
      const target = Math.round((offset.current + travel + center) / step) * step - center;
      seek.current = target - offset.current;
      resumeAfter.current = performance.now() + 1600;
    }
    const container = viewport.current;
    if (container?.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
    wake.current();
  }, []);

  useEffect(() => {
    // Also finish a press released outside the gallery or when focus leaves the window.
    const up = (event: globalThis.PointerEvent) => finishDrag(event.pointerId, false, event.timeStamp);
    const cancel = (event: globalThis.PointerEvent) => finishDrag(event.pointerId, true);
    const blur = () => finishDrag(drag.current.pointerId, true);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
    };
  }, [finishDrag]);
  const navItems = ["HOME", "ABOUT", "PROJECT", "SPACE Modeling"];
  const navAction = (item: string) => {
    setActiveNav(item);
    if (item === "HOME") { window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" }); return; }
    if (item === "ABOUT") { document.getElementById("core-values")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" }); return; }
    setNotice(item);
  };

  return (
    <main className={styles.page} id="oven-home" data-reduced-motion={reduced} data-enhanced={enhanced}>
      <a className={styles.skipLink} href="#core-values">핵심 가치 카드로 바로가기</a>
      <div className={styles.atmosphere} aria-hidden="true">
        <Image className={styles.heatTop} src="/oven-sauna/assets/heat-0.png" alt="" width={1952} height={778} priority />
        <Image className={styles.heatBottom} src="/oven-sauna/assets/heat-1.png" alt="" width={1952} height={778} priority />
        <div className={styles.topFade} />
      </div>
      <header className={styles.header}>
        <a className={styles.brand} href="#oven-home" aria-label="GOOBNE OVEN SAUNA 홈">
          <Image className={styles.brandMark} src="/oven-sauna/assets/brand-mark.svg" alt="" width={43} height={39} />
          <span><strong>GOOBNE OVEN SAUNA</strong><small>2026 DDP YOUNG DESIGNER</small></span>
        </a>
        <nav className={styles.nav} aria-label="주요 메뉴">
          {navItems.map((item) => <button type="button" key={item} data-current={activeNav === item} aria-current={activeNav === item ? "page" : undefined} onClick={() => navAction(item)}><RollingLabel text={item} /></button>)}
        </nav>
        <button className={styles.contact} onClick={() => setNotice("Contact US")} type="button"><RollingLabel text="Contact US" /></button>
      </header>
      <HeatAtmosphere reduced={reduced} enhanced={enhanced} />
      <section className={styles.intro} aria-labelledby="value-title">
        <p className={styles.eyebrow}>BRAND STRATIGIES</p>
        <h1 id="value-title">OUR CORE VALUE</h1>
        <p className={styles.introDescription}>
          <span className={styles.introLine}>OVEN SAUNA는 굽네의 ‘열’을 먹고, 쉬고, 함께하는 경험으로 확장합니다.</span>{" "}
          <span className={styles.introLine}>맛있는 즐거움과 편안한 휴식, 사람 사이의 연결이 자연스럽게 이어지는 브랜드 경험을 제안합니다.</span>
        </p>
      </section>
      <section id="core-values" className={styles.gallery} aria-label="OVEN SAUNA의 네 가지 핵심 가치" aria-roledescription="캐러셀">
        <div
          ref={viewport}
          className={styles.viewport}
          data-dragging={dragging}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => finishDrag(event.pointerId, false, event.timeStamp)}
          onPointerCancel={(event) => finishDrag(event.pointerId, true)}
          onLostPointerCapture={(event) => {
            // Touch first captures the button implicitly. Its bubbled loss during
            // transfer to the gallery must not cancel the gallery's drag.
            if (event.target === event.currentTarget) finishDrag(event.pointerId, true);
          }}
          onDragStart={(event) => event.preventDefault()}
          onClickCapture={(event) => { if (suppressClick.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); } }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setSelected(null); setHovered(null); setFocused(null); (document.activeElement as HTMLElement)?.blur(); }
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              const current = active === null ? 0 : active % values.length;
              const index = (current + (event.key === "ArrowRight" ? 1 : -1) + values.length) % values.length;
              (rail.current?.children[index].querySelector("button") as HTMLElement)?.focus({ preventScroll: true });
              focusCard(index);
            }
          }}
        >
          <div ref={rail} className={styles.rail}>
            {[...values, ...values].map((value, index) => (
              <ValueCard
                key={`${value.id}-${index}`}
                value={value}
                index={index}
                active={active === index}
                enhanced={enhanced}
                onEnter={() => setCardHover(index)}
                onLeave={() => setCardHover(null)}
                onFocus={() => focusCard(index)}
                onBlur={() => setFocused(null)}
                onToggle={() => { setHovered(null); setFocused(null); setSelected(selected === index ? null : index); }}
              />
            ))}
          </div>
        </div>
        <div className={styles.galleryFooter}>
          <p className={styles.gestureHint}><span className={styles.liveDot} data-paused={paused || reduced || active !== null || dragging} /> <span className={styles.desktopHint}>DRAG TO EXPLORE · HOVER TO DISCOVER</span><span className={styles.touchHint}>옆으로 밀어 넘기고, 터치해 보세요</span></p>
          <div className={styles.galleryControls}>
            <button type="button" onClick={() => move(-1)} aria-label="이전 카드">←</button>
            <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "카드 자동 이동 재생" : "카드 자동 이동 일시정지"} aria-pressed={paused} disabled={reduced} className={styles.pauseButton}>{paused || reduced ? "재생" : "일시정지"}</button>
            <button type="button" onClick={() => move(1)} aria-label="다음 카드">→</button>
          </div>
        </div>
      </section>
      {notice && <Notice title={notice} onClose={() => setNotice(null)} />}
    </main>
  );
}

function RollingLabel({ text }: { text: string }) {
  return <span className={styles.rolling}><span>{text}</span><span aria-hidden="true">{text}</span></span>;
}

function Notice({ title, onClose }: { title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={styles.dialog} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogBody}>
      <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="닫기">×</button>
      <p>GOOBNE OVEN SAUNA</p><h2>{title}</h2>
      <p>{title === "Contact US" ? "프로젝트의 연락처 정보가 준비되면 이곳에서 안내해 드립니다." : "새로운 브랜드 경험을 준비하고 있습니다. 먼저 OVEN SAUNA의 네 가지 핵심 가치를 만나보세요."}</p>
      <button type="button" className={styles.dialogAction} onClick={onClose}>돌아가기 <span aria-hidden="true">↗</span></button>
    </div>
  </dialog>;
}
