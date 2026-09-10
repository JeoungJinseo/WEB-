const trails = [
  'M-140 370C120 460 190 195 510 210S1050 345 1330 205S1600 95 1740 135',
  'M-160 920C140 705 375 970 735 850S1130 600 1430 685S1620 795 1750 670',
  'M-160 620C95 730 100 395 290 390S410 525 520 450',
];

/** Broad, faint halos and fine cores keep the steam visible over the artwork. */
export function SaunaSteam() {
  return (
    <svg className="sauna-steam-trails" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sauna-steam-fade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0" stopColor="#fff6ef" stopOpacity="0" />
          <stop offset=".16" stopColor="#fff6ef" stopOpacity=".8" />
          <stop offset=".5" stopColor="#fff" />
          <stop offset=".84" stopColor="#fff6ef" stopOpacity=".65" />
          <stop offset="1" stopColor="#fff6ef" stopOpacity="0" />
        </linearGradient>
        <filter id="sauna-steam-halo" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {trails.map((path, index) => (
        <g key={path} className={`sauna-steam-trail sauna-steam-trail-${index}`}>
          <path d={path} className="sauna-steam-halo" />
          <path d={path} className="sauna-steam-core" />
        </g>
      ))}
    </svg>
  );
}
