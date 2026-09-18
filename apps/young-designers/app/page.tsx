'use client';

import { useState } from 'react';
import InkFeedback from './effects/InkFeedback';

export default function Home() {
  const [intro, setIntro] = useState(0);
  const replay = () => setIntro(n => n + 1);

  return <main className="exhibition" id="home" data-figma-node="1057:1295">
    <header className="site-header" key={`header-${intro}`}>
      <a className="brand" href="#home" onClick={replay} aria-label="Goobne Oven Sauna — replay introduction">
        <span className="brand-icon"><img className="brand-mark" src="/assets/logo.svg" alt="" /></span>
        <span className="brand-copy"><strong>GOOBNE OVEN SAUNA</strong><small>2026 DDP YOUNG DESIGNER</small></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#home" onClick={replay}>HOME</a>
        <a href="https://oven-sauna-ddp.harry040904.chatgpt.site/#front">ABOUT</a>
        <a href="#project" className="active" aria-current="page" onClick={replay}>PROJECT</a>
        <button disabled>DEVICES</button>
      </nav>
      <button className="contact" disabled>Contact US</button>
    </header>
    <svg className="band-vapor-filter" aria-hidden="true" focusable="false">
      <defs>
        <filter id="band-vapor-density" x="-2%" y="-100%" width="104%" height="300%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".006 .018" numOctaves="2" seed="21" result="mist">
            <animate attributeName="baseFrequency" values=".006 .018;.0066 .021;.0056 .019;.006 .018" dur="22s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.333;.667;1" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1" />
          </feTurbulence>
          <feColorMatrix in="mist" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -.1" result="density" />
          <feComposite in="SourceGraphic" in2="density" operator="in" />
        </filter>
      </defs>
    </svg>
    <div className="heat-stripes" key={`bands-${intro}`} aria-hidden="true"><i /><i /><i /><i /></div>
    <section className="hero" id="project" key={intro} aria-label="We are young designers">
      <div className="heat-background" aria-hidden="true" />
      <div className="vapor-back" aria-hidden="true"><img src="/assets/steam-back.svg" alt="" draggable={false} /></div>
      <div className="vapor-layout" aria-hidden="true" />
      <h1 className="title" aria-label="WE ARE YOUNG DESIGNERS">
        <span className="title-layout">
        <span className="we-are title-line" aria-hidden="true">
          <span className="unfold-mask"><span className="unfold-type"><img src="/assets/we-are.svg" alt="" /><img className="title-stroke" src="/assets/we-are-stroke.svg" alt="" /></span></span>
        </span>
        <span className="young-designers title-line" aria-hidden="true">
          <span className="unfold-mask"><span className="unfold-type"><img src="/assets/young-designers.svg" alt="" /></span></span>
        </span>
        </span>
      </h1>
      <div className="vapor-front-follow" aria-hidden="true"><div className="vapor-front"><img className="vapor-animated" src="/assets/steam-front-diffusing.svg" alt="" draggable={false} /><img className="vapor-still" src="/assets/steam-front.svg" alt="" draggable={false} /></div></div>
      <div className="vapor-upper" aria-hidden="true"><img src="/assets/steam-front-diffusing.svg" alt="" draggable={false} /></div>
      <InkFeedback />
      <div className="heat-sweep" aria-hidden="true" />
    </section>
  </main>;
}
