import { useEffect, useRef } from 'react';
import { SaunaVapor } from '@/components/sauna-vapor';

/** The same background exports and heat bands as the supplied DDP depth gallery. */
export function SaunaAtmosphere() {
  const filterRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = filterRef.current;
    if (!svg) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (reduced.matches || document.hidden) svg.pauseAnimations();
      else svg.unpauseAnimations();
    };
    sync();
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      svg.pauseAnimations();
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <div className="sauna-atmosphere" aria-hidden="true">
      <div className="sauna-background sauna-background-intro">
        <svg ref={filterRef} className="sauna-band-filter" focusable="false">
          <defs>
            <filter id="sauna-band-density" x="-2%" y="-100%" width="104%" height="300%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency=".006 .018" numOctaves="2" seed="21" result="mist">
                <animate attributeName="baseFrequency" values=".006 .018;.0066 .021;.0056 .019;.006 .018" dur="66s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.333;.667;1" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1" />
              </feTurbulence>
              <feColorMatrix in="mist" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -.1" result="density" />
              <feComposite in="SourceGraphic" in2="density" operator="in" />
            </filter>
          </defs>
        </svg>
        <div className="sauna-heat-bands"><i /><i /><i /><i /></div>
        <div className="sauna-heat-glow" />
      </div>
      <div className="sauna-background sauna-background-left" />
      <div className="sauna-background sauna-background-right" />
      <SaunaVapor />
    </div>
  );
}
