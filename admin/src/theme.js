import { useEffect, useState } from 'react';

const KEY = 'gebeta.admin.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

/** Resolved before paint so a refresh never flashes the wrong palette. */
export function applyTheme(mode) {
  const resolved = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  window.dispatchEvent(new CustomEvent('gebeta-theme', { detail: resolved }));
  return resolved;
}

export function readTheme() {
  const stored = localStorage.getItem(KEY);
  return ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
}

applyTheme(readTheme());

export function useTheme() {
  const [mode, setMode] = useState(readTheme);
  const [resolved, setResolved] = useState(() => applyTheme(mode));

  useEffect(() => {
    localStorage.setItem(KEY, mode);
    setResolved(applyTheme(mode));
    if (mode !== 'system') return undefined;
    const onChange = () => setResolved(applyTheme('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  return { mode, setMode, resolved };
}
