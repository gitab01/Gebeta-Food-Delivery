import React from 'react';
import { useTheme } from './theme.js';

/**
 * The same mark the Expo apps draw with Views: a round platter seen from above with
 * the shared portion filled in. Here it is an SVG so it inherits the page palette.
 */
export function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="logo">
      <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="20" cy="20" r="7.5" fill="var(--accent)" stroke="none" />
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
