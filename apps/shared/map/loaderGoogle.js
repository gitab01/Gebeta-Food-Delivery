/**
 * Loads the Google Maps JavaScript API once per page. Only imported by the web map, so
 * the script tag never appears in a native bundle. A failed load is cleared so the next
 * render can retry instead of being stuck on a rejected promise forever.
 */
let pending = null;

export function loadGoogleMaps(key) {
  if (typeof window === 'undefined' || !key) return Promise.reject(new Error('MAPS_UNAVAILABLE'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => (window.google?.maps ? resolve(window.google.maps) : reject(new Error('MAPS_LOAD_FAILED')));
    script.onerror = () => reject(new Error('MAPS_LOAD_FAILED'));
    document.head.appendChild(script);
  }).catch((err) => {
    pending = null;
    throw err;
  });

  return pending;
}

/** Muted, borderless map chrome so the tiles read as part of the app, not an embed. */
export const MAP_OPTIONS = (dark) => ({
  disableDefaultUI: true,
  zoomControl: false,
  draggableCursor: 'default',
  backgroundColor: dark ? '#000000' : '#ffffff',
  styles: dark
    ? [
        { elementType: 'geometry', stylers: [{ color: '#1b1b1f' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#b4b4bc' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#121215' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a30' }] }
      ]
    : [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
});
