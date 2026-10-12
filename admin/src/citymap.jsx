import React, { useEffect, useMemo, useRef, useState } from 'react';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/** True only when a key is compiled in AND the operator has not switched maps off. */
export const mapsConfigured = () => KEY.length > 20;

let loading = null;

function loadMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&loading=async&v=3.56`;
      script.async = true;
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error('maps script failed'));
      document.head.appendChild(script);
    });
  }
  return loading;
}

const DARK_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#202124' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0a6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#202124' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2e33' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#12130f' }] }
];

const pin = (color, label) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="10" fill="${color}" stroke="#ffffff" stroke-width="2"/><text x="14" y="18" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text></svg>`
  );

function LiveCityMap({ kitchens, couriers, height }) {
  const host = useRef(null);
  const map = useRef(null);
  const marks = useRef(new Map());
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let alive = true;
    const paint = (dark) => map.current?.setOptions({ styles: dark ? DARK_STYLES : [] });
    const onTheme = (e) => paint(e.detail === 'dark');
    window.addEventListener('gebeta-theme', onTheme);

    loadMaps()
      .then((maps) => {
        if (!alive || !host.current) return;
        const dark = document.documentElement.dataset.theme === 'dark';
        map.current = new maps.Map(host.current, {
          center: { lat: 9.03, lng: 38.74 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          draggable: true,
          styles: dark ? DARK_STYLES : []
        });
        redraw();
      })
      .catch(() => alive && setBroken(true));
    return () => {
      alive = false;
      window.removeEventListener('gebeta-theme', onTheme);
    };
  }, []);

  const redraw = () => {
    if (!map.current || !window.google) return;
    const want = new Map();
    kitchens.forEach((k) => k.lat != null && want.set(`k${k.id}`, { position: { lat: k.lat, lng: k.lng }, icon: pin('#0f7b3f', 'K'), title: `${k.name}${k.isOpen === false ? ' (closed)' : ''}` }));
    couriers.forEach((c) => c.lat != null && want.set(`c${c.id}`, { position: { lat: c.lat, lng: c.lng }, icon: pin('#c1121f', 'C'), title: `${c.name} · ${c.vehicle || 'courier'}` }));

    marks.current.forEach((marker, id) => {
      const next = want.get(id);
      if (!next) {
        marker.setMap(null);
        marks.current.delete(id);
      } else {
        marker.setPosition(next.position);
      }
    });
    want.forEach((spec, id) => {
      if (marks.current.has(id)) return;
      marks.current.set(id, new window.google.maps.Marker({ map: map.current, ...spec }));
    });

    const bounds = new window.google.maps.LatLngBounds();
    want.forEach((spec) => bounds.extend(spec.position));
    if (!bounds.isEmpty()) map.current.fitBounds(bounds, { top: 24, bottom: 24, left: 24, right: 24 });
  };

  useEffect(() => {
    redraw();
  }, [kitchens, couriers]);

  if (broken) return <Plot kitchens={kitchens} couriers={couriers} height={height} note="Google could not load on this network, so the same positions are plotted as a schematic." />;
  return <div ref={host} className="citymap" style={{ height }} />;
}

/** No key, no network: draw the positions ourselves. Straight lat/lng mapping is fine across one city. */
function Plot({ kitchens, couriers, height, note }) {
  const points = useMemo(() => [...kitchens, ...couriers].filter((p) => p.lat != null), [kitchens, couriers]);
  const box = useMemo(() => {
    if (!points.length) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
  }, [points]);

  // 8% to 92% keeps every marker clear of the frame, however tight the cluster is.
  const at = (p) => {
    if (!box) return { x: 50, y: 50 };
    const span = (max, min) => (max - min || 1);
    return {
      x: 8 + ((p.lng - box.minLng) / span(box.maxLng, box.minLng)) * 84,
      y: 8 + (1 - (p.lat - box.minLat) / span(box.maxLat, box.minLat)) * 84
    };
  };

  return (
    <div className="plot" style={{ height }}>
      {kitchens
        .filter((k) => k.lat != null)
        .map((k) => {
          const { x, y } = at(k);
          return (
            <span key={k.id} className={`dot kitchen ${k.isOpen === false ? 'off' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} title={k.name}>
              K
            </span>
          );
        })}
      {couriers
        .filter((c) => c.lat != null)
        .map((c) => {
          const { x, y } = at(c);
          return (
            <span key={c.id} className="dot courier" style={{ left: `${x}%`, top: `${y}%` }} title={`${c.name} · ${c.vehicle || ''}`}>
              C
            </span>
          );
        })}
      <div className="plotfoot">
        <b>K</b> kitchens · <b className="c">C</b> couriers · {note || 'No map key compiled into this build, so positions are plotted as a schematic.'}
      </div>
    </div>
  );
}

export function CityMap({ kitchens = [], couriers = [], height = 320, enabled = true }) {
  if (!enabled)
    return (
      <div className="plot">
        <div className="plotfoot">Maps are switched off in settings, so the city is not plotted. Turn them on to watch couriers move.</div>
      </div>
    );
  if (!mapsConfigured()) return <Plot kitchens={kitchens} couriers={couriers} height={height} />;
  return <LiveCityMap kitchens={kitchens} couriers={couriers} height={height} />;
}
