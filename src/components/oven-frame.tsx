import { useEffect, useRef } from 'react';

interface OvenFrameProps {
  chapter: number;
  onNavigate: (progress: number) => void;
}

export function OvenFrame({ chapter, onNavigate }: OvenFrameProps) {
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    const page = header?.parentElement;
    if (!header || !page) return;
    const syncHeight = () => page.style.setProperty('--oven-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      page.style.removeProperty('--oven-header-height');
    };
  }, []);

  return (
    <header ref={headerRef} className="oven-header">
      <button className="oven-brand" aria-label="GOOBNE OVEN SAUNA 시작으로" onClick={() => onNavigate(0)}>
        <img src="./brand/oven-sauna-logo.svg" width="993" height="245" alt="OVEN SAUNA" />
        <small>2026 DDP YOUNG DESIGNER</small>
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
  );
}
