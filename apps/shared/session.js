import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { api, closeRealtime, realtime, setToken } from './api';

/**
 * Session lives in memory on device and in localStorage on web, because a browser
 * refresh that drops the token would drop the live socket too.
 */
const KEY = 'gebeta.session';

const readStored = () => {
  if (Platform.OS !== 'web') return null;
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};

const writeStored = (value) => {
  if (Platform.OS !== 'web') return;
  if (value) window.localStorage.setItem(KEY, JSON.stringify(value));
  else window.localStorage.removeItem(KEY);
};

const SessionContext = createContext(null);

// Screens mount before this provider's effect runs, so the token has to be on the API
// client already - otherwise a deep link into the tracker asks for it and never retries.
const boot = readStored();
if (boot?.token) setToken(boot.token);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = readStored();
    if (!stored?.token) {
      setChecking(false);
      return;
    }
    setToken(stored.token);
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => {
        setToken(null);
        writeStored(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const adopt = useCallback((data) => {
    setToken(data.token);
    writeStored(data);
    setUser(data.user);
    realtime(); // pick up the new token on the shared socket
    return data.user;
  }, []);

  const login = useCallback(
    async (phone, password) => adopt(await api.login({ phone, password })),
    [adopt]
  );

  const register = useCallback(
    async (payload) => adopt(await api.register(payload)),
    [adopt]
  );

  const logout = useCallback(() => {
    closeRealtime();
    setToken(null);
    writeStored(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, checking, login, register, logout, setUser }),
    [user, checking, login, register, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
