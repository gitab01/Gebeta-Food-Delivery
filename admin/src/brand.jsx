import React from 'react';
import { useTheme } from './theme.js';

/**
 * The woven gebeta basket — the same mark apps/shared/brand.js draws, here as plain SVG
 * so it inherits the page palette and stays crisp in the sidebar at 20px.
 */
export function Logo({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="logo"
      fill="none"
      stroke="var(--gold)"
      strokeWidth="3.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="20" cy="4.6" rx="3" ry="1.7" />
      <path d="M16.9 7.1L15.4 10M23.1 7.1L24.6 10" />
      <path d="M12 15.2Q20 9.8 28 15.2" />
      <path d="M8.6 20.6Q20 13.2 31.4 20.6" />
      <path d="M5.6 26.2Q20 16 34.4 26.2" />
      <path d="M9.2 31.6Q20 34.8 30.8 31.6" />
      <path d="M13 36.6Q20 39 27 36.6" />
    </svg>
  );
}

/** The gebeta artwork's own colours — fixed, so the mark never repaints with the theme. */
const ART = {
  cream: '#f4e7d1',
  navy: '#1e2a55',
  rust: '#d9542b',
  mound: '#c9975f',
  moundInk: '#8c6239',
  green: '#3f7a46'
};

/**
 * The full-colour gebeta from the reference illustration, for centred hero placements
 * at 56px and up. Below that use `Logo`, whose single-weight strands survive scaling.
 */
export function BasketMark({ size = 96 }) {
  const edge = { stroke: ART.navy, strokeWidth: 1.6, strokeLinejoin: 'round', fill: ART.cream };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="basket">
      <path className="wisp" d="M20 17c-3-3 3-5.5 0-8.5" />
      <path className="wisp two" d="M29.5 16c3-3-3-5.5 0-8.5" />
      <path
        d="M12 33 Q14.5 21.5 24.5 19 Q34 17 40 23.5 Q45.5 28 48.5 33 Z"
        fill={ART.mound}
        stroke={ART.moundInk}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 32q1.5-6 5.5-5.2t3 5.8M28 31q1.5-6 5.5-5.2t3 5.8M23 24.5q1.5-4.5 4.8-4t2.4 4.8"
        fill="none"
        stroke={ART.moundInk}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <g transform="translate(41.5 30) rotate(32)">
        <path d="M-13 0 L13 0 L0 -16 Z" {...edge} />
        <path d="M-11 0 L11 0 L9.2 -5 L7.3 0 L5.5 -5 L3.7 0 L1.8 -5 L0 0 L-1.8 -5 L-3.7 0 L-5.5 -5 L-7.3 0 L-9.2 -5 Z" fill={ART.rust} />
        <path d="M-13 0 Q0 4 13 0" {...edge} />
        <circle cx="0" cy="-18.5" r="2.6" {...edge} />
      </g>
      <path d="M9 33 L17 53 Q32 59 47 53 L55 33 Z" fill={ART.cream} stroke={ART.navy} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 30.5 H55 V35 H9 Z" fill={ART.cream} stroke={ART.navy} strokeWidth="1.7" strokeLinejoin="round" />
      <path
        d="M11 35 H53 L50.7 41 L48.3 35 L46 41 L43.7 35 L41.3 41 L39 35 L36.7 41 L34.3 35 L32 41 L29.7 35 L27.3 41 L25 35 L22.7 41 L20.3 35 L18 41 L15.7 35 L13.3 41 Z"
        fill={ART.rust}
      />
      <path
        d="M15 49.5 L17.8 44 L20.7 49.5 Z M20.7 49.5 L23.5 44 L26.3 49.5 Z M26.3 49.5 L29.2 44 L32 49.5 Z M32 49.5 L34.8 44 L37.7 49.5 Z M37.7 49.5 L40.5 44 L43.3 49.5 Z M43.3 49.5 L46.2 44 L49 49.5 Z"
        fill={ART.navy}
      />
      <path d="M16.4 49.5 H47.6 L46 53 Q32 58.6 18 53 Z" fill={ART.green} stroke={ART.navy} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ product = 'Admin' }) {
  return (
    <div className="brand">
      <Logo />
      <span>
        Gebeta{product ? <em>{product}</em> : null}
      </span>
    </div>
  );
}

const PATHS = {
  pulse: 'M3 13h4l3-8 4 16 3-8h4',
  store: 'M4 9h16l-1 11H5L4 9Zm2-4h12l2 4H6l2-4Zm6 14h4',
  bike: 'M6 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6-8h4l2 8M6 9h4l3 8',
  users: 'M8 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 0a3 3 0 1 0 0-6M2 21a6 6 0 0 1 12 0m2 0a6 6 0 0 1 6-6',
  chart: 'M4 20V10m5 10V6m5 14v-8m5 8V8',
  sliders: 'M4 8h11m5 0h0M4 16h5m5 0h6M15 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm-6 8a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z',
  flame: 'M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3-1-5 1-8Z',
  sun: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0-4v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19',
  moon: 'M18 14a7 7 0 1 1-9-9 6 6 0 0 0 9 9Z',
  system: 'M4 5h11v10H4zM17 11h3v8h-6v-3',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  refresh: 'M20 12a8 8 0 1 1-3-6m3-2v4h-4',
  shield: 'M12 3l7 3v5c0 4.4-2.9 7.7-7 9-4.1-1.3-7-4.6-7-9V6l7-3Zm-2.8 9.2 2 2 3.6-4.2',
  signout: 'M14 4h5v16h-5M4 12h9m-4-4-4 4 4 4'
};

export function Ico({ name, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="ico">
      <path d={PATHS[name] || PATHS.pulse} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const options = [
    { value: 'system', icon: 'system', label: 'Auto' },
    { value: 'light', icon: 'sun', label: 'Light' },
    { value: 'dark', icon: 'moon', label: 'Dark' }
  ];
  return (
    <div className="seg" role="group" aria-label="Colour theme">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={mode === o.value ? 'on' : ''}
          onClick={() => setMode(o.value)}
          title={o.label}
          aria-label={o.label}
        >
          <Ico name={o.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
