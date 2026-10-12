import { useEffect, useState } from 'react';
import { getPref, onPrefsChange, PREF, setPref } from '../prefs';

const EXPO_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** The key is compiled into the client bundle, so it is never a secret — referrer/bundle restrictions are. */
export const mapsKey = () => String(EXPO_KEY).trim();
export const mapsReady = () => mapsKey().length > 20;

/** Without a key the map still draws the same positions, just from the schematic projection. */
export const mapsOn = () => mapsReady() && getPref(PREF.map) !== 'off';

export function useMapsOn() {
  const [on, setOn] = useState(mapsOn);
  useEffect(() => onPrefsChange(() => setOn(mapsOn())), []);
  return on;
}

export const setMapsOn = (value) => setPref(PREF.map, value ? 'on' : 'off');
