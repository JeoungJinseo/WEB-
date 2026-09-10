interface OvenFrameProps {
  chapter: number;
  onNavigate: (progress: number) => void;
}

export function OvenFrame({ chapter, onNavigate }: OvenFrameProps) {
  return (
    <header className="oven-header">
      <button className="oven-brand" aria-label="GOOBNE OVEN SAUNA 시작으로" onClick={() => onNavigate(0)}>
        <img src="./brand/mark.svg" width="43" height="39" alt="" />
        <span><strong>GOOBNE OVEN SAUNA</strong><small>2026 DDP YOUNG DESIGNER</small></span>
      </button>
      <nav className="oven-nav" aria-label="메인 메뉴">
        {[
          { label: 'HOME', progress: 0 },
          { label: 'ABOUT', progress: 0.22 },
          { label: 'PROJECT', progress: 0.405 },
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
