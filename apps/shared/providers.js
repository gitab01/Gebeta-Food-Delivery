import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from './lang';
import { loadPrefs, PREF_KEYS } from './prefs';
import { ThemeProvider, useTheme } from './theme';

/**
 * Both Expo apps boot the same way: read the stored preferences first, then mount the
 * providers that consume them. On the web the read is synchronous, on a phone it is
 * awaited, so a courier's dark-mode choice survives a cold start instead of flashing
 * white for a frame.
 */
function ModeStatusBar() {
  const { resolved } = useTheme();
  return <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />;
}

export function AppProviders({ children }) {
  const [ready, setReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    let alive = true;
    loadPrefs(PREF_KEYS).finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <LanguageProvider>
        <ModeStatusBar />
        {children}
      </LanguageProvider>
    </ThemeProvider>
  );
}
