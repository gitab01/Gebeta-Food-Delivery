import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getPref, onPrefsChange, PREF, setPref } from './prefs';

/**
 * One palette, two modes. Backgrounds stay pure white or pure black in both apps —
 * separation comes from 1px borders, never from gradients, glows or tinted bands.
 */
const light = {
  paper: '#ffffff',
  ink: '#0b0b0c',
  muted: '#63636a',
  faint: '#9a9aa2',
  line: '#e8e8ec',
  tint: '#f6f6f8',
  accent: '#c1121f',
  accentInk: '#8c0d18',
  accentTint: '#fdecec',
  green: '#0f7b3f',
  greenTint: '#e9f6ee',
  amber: '#a8620a',
  amberTint: '#fdf3e4',
  blue: '#12467f',
  blueTint: '#eaf1f9',
  onAccent: '#ffffff'
};

const dark = {
  paper: '#000000',
  ink: '#ffffff',
  muted: '#b4b4bc',
  faint: '#7d7d86',
  line: '#2a2a30',
  tint: '#121215',
  accent: '#e0343f',
  accentInk: '#ff858c',
  accentTint: 'rgba(224, 52, 63, 0.16)',
  green: '#3ecf7e',
  greenTint: 'rgba(62, 207, 126, 0.15)',
  amber: '#e6a455',
  amberTint: 'rgba(230, 164, 85, 0.15)',
  blue: '#6fa8e8',
  blueTint: 'rgba(111, 168, 232, 0.15)',
  onAccent: '#ffffff'
};

export const MODES = ['system', 'light', 'dark'];

function buildType() {
  return {
    eyebrow: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '600' },
    h1: { fontSize: 28, lineHeight: 32, fontWeight: '700', color: colors.ink, letterSpacing: -0.6 },
    h2: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
    h3: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
    body: { fontSize: 15, lineHeight: 22, color: colors.ink },
    small: { fontSize: 13, lineHeight: 19, color: colors.muted },
    tiny: { fontSize: 11, lineHeight: 15, color: colors.faint },
    mono: { fontFamily: 'Menlo', fontSize: 12, color: colors.muted }
  };
}

/**
 * `colors` and `type` are live: switching mode writes the new palette into them and
 * bumps a version, and `useStyles` rebuilds each screen's stylesheet off that bump.
 * That keeps dark mode out of every component's props.
 */
export const colors = { ...light };
export const type = buildType();

const applyMode = (mode) => {
  Object.assign(colors, mode === 'dark' ? dark : light);
  Object.assign(type, buildType());
};

const resolve = (mode, system) => (mode === 'dark' || (mode === 'system' && system === 'dark') ? 'dark' : 'light');

const initialMode = () => {
  const stored = getPref(PREF.theme);
  return MODES.includes(stored) ? stored : 'system';
};

// Applied while the module loads so an explicit dark choice never flashes white.
if (initialMode() === 'dark') applyMode('dark');

const ThemeContext = createContext({ mode: 'system', resolved: 'light', setMode: () => {}, version: 0 });

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState(initialMode);
  const [version, bump] = useState(0);
  const resolved = resolve(mode, system);

  useEffect(() => {
    applyMode(resolved);
    bump((v) => v + 1);
  }, [resolved]);

  useEffect(() => {
    const off = onPrefsChange(() => setModeState(initialMode()));
    return off;
  }, []);

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return;
    setModeState(next);
    setPref(PREF.theme, next);
    applyMode(next === 'system' ? resolve('system', system) : next);
    bump((v) => v + 1);
  }, [system]);

  const value = useMemo(() => ({ mode, resolved, setMode, version }), [mode, resolved, setMode, version]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Screens keep writing `const styles = StyleSheet.create(...)` at module scope; they
 * only change it to `const makeStyles = () => StyleSheet.create(...)` and read it
 * back through this hook, so a mode switch repaints the whole app.
 */
export function useStyles(make) {
  const { version } = useContext(ThemeContext);
  return useMemo(make, [version]);
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

/** Status → colour, so a status chip reads the same in both apps. */
export const statusColor = (status) => {
  if (status === 'COMPLETED' || status === 'DELIVERED') return { fg: colors.green, bg: colors.greenTint };
  if (status === 'REJECTED' || status === 'CANCELLED') return { fg: colors.accentInk, bg: colors.accentTint };
  if (status === 'PLACED' || status === 'PAID') return { fg: colors.blue, bg: colors.blueTint };
  if (status === 'READY') return { fg: colors.amber, bg: colors.amberTint };
  return { fg: colors.accentInk, bg: colors.accentTint };
};
