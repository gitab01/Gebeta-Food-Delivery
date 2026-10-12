import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { api, realtime } from '../../shared/api';

/**
 * The courier's position is an input to the whole system — the customer's tracker,
 * the ETA, and the next assignment round all read it — so it is reported from the
 * root layout rather than a single screen. The server throttles it; we just keep sending.
 *
 * The same fixes are handed to `watchers` so a screen can show the courier's own marker
 * on a map without asking the device for permission a second time.
 */
let latest = { lat: null, lng: null, at: null };
const watchers = new Set();

function report(coords) {
  latest = { lat: coords.lat, lng: coords.lng, at: new Date(coords.at || Date.now()).toISOString() };
  watchers.forEach((fn) => fn(latest));
}

export function useReportedPosition() {
  const [value, setValue] = useState(latest);
  useEffect(() => {
    watchers.add(setValue);
    return () => watchers.delete(setValue);
  }, []);
  return value;
}
function publish({ lat, lng }, force = false) {
  // A device that has not locked onto satellites reports 0,0, and one of those
  // pings is enough to drag a customer's map and the admin city plot to the Gulf of Guinea.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
  report({ lat, lng });
  const socket = realtime();
  if (socket.connected) {
    socket.emit('courier:location', { lat, lng, force });
    return;
  }
  api.courierLocation(lat, lng).catch(() => {}); // REST fallback keeps the trail unbroken
}

export function sendPositionOnce({ lat, lng }) {
  publish({ lat, lng }, true);
}

/** One-shot report for the "am I really here?" moment at a door. */
export async function sendDevicePosition() {
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
  publish(coords, true);
  return coords;
}

export async function requestPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export function usePositionReporting(enabled) {
  const [state, setState] = useState({ status: enabled ? 'asking' : 'off', error: '', lat: null, lng: null, at: null });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'off', error: '', lat: null, lng: null, at: null });
      return undefined;
    }
    let cancelled = false;
    let subscription = null;

    (async () => {
      const granted = await requestPermission();
      if (cancelled) return;
      if (!granted) {
        setState({ status: 'denied', error: 'Location is off, so customers cannot see you and you cannot confirm a stop.', lat: null, lng: null, at: null });
        return;
      }
      setState((current) => ({ ...current, status: 'sharing' }));
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 8000 },
        (position) => {
          if (cancelled) return;
          const { latitude: lat, longitude: lng } = position.coords;
          setState((current) => ({ ...current, status: 'sharing', error: '', lat, lng, at: new Date(position.timestamp).toISOString() }));
          publish({ lat, lng });
        }
      );
    })();

    return () => {
      cancelled = true;
      if (subscription && typeof subscription.remove === 'function') subscription.remove();
    };
  }, [enabled]);

  return state;
}
