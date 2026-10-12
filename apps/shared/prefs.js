import { Platform } from 'react-native';

/**
 * Theme mode and language have to survive a restart, and both apps run on the web
 * and on a phone from the same code. Web has synchronous localStorage; on native
 * the preference lives in AsyncStorage when it is installed and in this module's
 * cache either way, so a choice made on one screen applies immediately everywhere.
 */
const cache = new Map();
const listeners = new Set();

let storage = null;
if (Platform.OS !== 'web') {
  try {
    // Optional: the apps work without it, they just forget the choice on restart.
    // eslint-disable-next-line global-require
    storage = require('@react-native-async-storage/async-storage').default || null;
  } catch {
    storage = null;
  }
}

function webGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode or a full quota — the in-memory cache still holds the choice */
  }
}

export function getPref(key) {
  if (cache.has(key)) return cache.get(key);
  return Platform.OS === 'web' ? webGet(key) : null;
}

export function setPref(key, value) {
  cache.set(key, value);
  if (Platform.OS === 'web') webSet(key, value);
  else storage?.setItem(key, value).catch(() => {});
  listeners.forEach((fn) => fn(key, value));
}

/** Pulls native preferences into the cache; resolves with the values just read. */
export async function loadPrefs(keys) {
  if (Platform.OS === 'web' || !storage) return {};
  try {
    const pairs = await storage.multiGet(keys.map((key) => [key, null]));
    const read = {};
    pairs.forEach(([key, value]) => {
      if (value != null) {
        cache.set(key, value);
        read[key] = value;
      }
    });
    listeners.forEach((fn) => fn('hydrate'));
    return read;
  } catch {
    return {};
  }
}

export function onPrefsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const PREF = { theme: 'gebeta.theme', lang: 'gebeta.lang', map: 'gebeta.map', notify: 'gebeta.notify' };
export const PREF_KEYS = [PREF.theme, PREF.lang, PREF.map, PREF.notify];
