"use client";

import { useEffect, useRef } from "react";
import styles from "./oven-sauna.module.css";

// The reference's four bands use drifting color through a changing vapor mask,
// rather than translating or bending the rectangular bands themselves.
export default function HeatAtmosphere({ reduced, enhanced }: { reduced: boolean; enhanced: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const filters = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = host.current;
    const svg = filters.current;
    if (!element || !svg) return;
    let visible = true;
    const sync = () => {
      const running = visible && !document.hidden && !reduced;
      element.dataset.running = String(running);
      if (running) svg.unpauseAnimations();
      else svg.pauseAnimations();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      svg.pauseAnimations();
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [reduced, enhanced]);

  return (
    <div ref={host} className={styles.heatAtmosphere} data-enhanced={enhanced} aria-hidden="true">
      {enhanced && <svg ref={filters} className={styles.heatFilters} focusable="false">
        <defs>
          <filter id="oven-band-vapor-density" x="-2%" y="-100%" width="104%" height="300%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".006 .018" numOctaves="2" seed="21" result="mist">
              <animate attributeName="baseFrequency" values=".006 .018;.0066 .021;.0056 .019;.006 .018" dur="22s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.333;.667;1" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1" />
            </feTurbulence>
            <feColorMatrix in="mist" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -.1" result="density" />
            <feComposite in="SourceGraphic" in2="density" operator="in" />
          </filter>
          <filter id="oven-ambient-vapor-density" x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".002 .007" numOctaves="2" seed="8" result="air">
              <animate attributeName="baseFrequency" values=".002 .007;.0026 .008;.0018 .0065;.002 .007" dur="28s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.333;.667;1" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1" />
            </feTurbulence>
            <feColorMatrix in="air" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.7 0 0 0 -.22" />
            <feGaussianBlur stdDeviation="12" result="density" />
            <feComposite in="SourceGraphic" in2="density" operator="in" />
          </filter>
        </defs>
      </svg>}
      <div className={styles.heatLines}><i /><i /><i /><i /></div>
      <div className={styles.heatGlow} />
    </div>
  );
}
