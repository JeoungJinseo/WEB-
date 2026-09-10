import { useLayoutEffect, useRef } from 'react';

interface OvenFrameProps {
  chapter: number;
  onNavigate: (progress: number) => void;
}

export function OvenFrame({ chapter, onNavigate }: OvenFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const page = frameRef.current?.parentElement;
    if (!header || !page) return;
    const syncHeight = () => page.style.setProperty('--oven-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    // Same 1440 × 1024 composition and portrait minimum as oven-sauna-ddp.
    // Scale the entire frame together, rather than sizing each item separately.
    const syncComposition = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const fit = Math.min(width / 1440, height / 1024);
      const scale = width < height ? Math.max(.62, fit) : fit;
      page.style.setProperty('--oven-ui-scale', String(scale));
      page.style.setProperty('--oven-ui-width', `${width / scale}px`);
      page.style.setProperty('--oven-ui-height', `${height / scale}px`);
      syncHeight();
    };
    syncComposition();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(header);
    window.addEventListener('resize', syncComposition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncComposition);
      ['--oven-header-height', '--oven-ui-scale', '--oven-ui-width', '--oven-ui-height']
        .forEach(property => page.style.removeProperty(property));
    };
  }, []);

  return (
    <div className="oven-chrome" ref={frameRef}>
    <header ref={headerRef} className="oven-header">
      <button className="oven-brand" aria-label="GOOBNE OVEN SAUNA 시작으로" onClick={() => onNavigate(0)}>
        <img className="oven-brand-mark" src="./brand/mark.svg" width="42.5" height="39.3" alt="" />
        <span className="oven-brand-type">
          <strong>GOOBNE OVEN SAUNA</strong>
          <small>2026 DDP YOUNG DESIGNER</small>
        </span>
      </button>
      <nav className="oven-nav" aria-label="메인 메뉴">
        {[
          { label: 'HOME', progress: 0 },
          { label: 'ABOUT', progress: 0.45 },
          { label: 'PROJECT', progress: 0.75 },
        ].map((item, index) => (
          <button key={item.label} aria-current={Math.min(chapter, 2) === index ? 'location' : undefined}
            onClick={() => onNavigate(item.progress)}>{item.label}</button>
        ))}
        <button disabled title="공간 모델링 페이지 연결 준비 중">SPACE Modeling</button>
      </nav>
      <button className="oven-contact" disabled title="연락처 연결 준비 중">Contact US</button>
    </header>
    <footer className="oven-footer"><span>GOOBNE OVEN SAUNA</span><span>2026 DDP YOUNG DESIGNER</span></footer>
    </div>
  );
}
