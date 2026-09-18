'use client';

import { useEffect, useRef } from 'react';

// Adapted from the user's goobne-young-designers heat-stripes and
// band-vapor-density effect. Keep the gallery's own Figma band positions.
export default function IntroHeatBands({ active }: { active: boolean }) {
  const filterRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = filterRef.current;
    if (!svg) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (active && !reduced.matches && !document.hidden)
        svg.unpauseAnimations();
      else svg.pauseAnimations();
    };
    sync();
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      svg.pauseAnimations();
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [active]);

  return (
    <>
      <svg
        ref={filterRef}
        className="intro-band-filter"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id="intro-band-vapor-density"
            x="-2%"
            y="-100%"
            width="104%"
            height="300%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".006 .018"
              numOctaves="2"
              seed="21"
              result="mist"
            >
              <animate
                attributeName="baseFrequency"
                values=".006 .018;.0066 .021;.0056 .019;.006 .018"
                dur="22s"
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;.333;.667;1"
                keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1"
              />
            </feTurbulence>
            <feColorMatrix
              in="mist"
              type="matrix"
              values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -.1"
              result="density"
            />
            <feComposite in="SourceGraphic" in2="density" operator="in" />
          </filter>
        </defs>
      </svg>
      <div className="intro-heat-bands" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="intro-heat-glow" aria-hidden="true" />
    </>
  );
}
