import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { colors, radius, useTheme } from '../theme';
import { mapsKey, mapsReady, useMapsOn } from './config';
import { loadGoogleMaps, MAP_OPTIONS } from './loaderGoogle';
import { Schematic, schematicHeight } from './Schematic';

/**
 * The web renderer: real Google tiles, driven only by positions the backend reported.
 * The view is fitted once per route and then follows the courier with a pan, so a live
 * map does not jump every few seconds.
 */
export function LiveMap(props) {
  const on = useMapsOn();
  if (!on) {
    const h = schematicHeight(props.height);
    return (
      <View style={[frame, { height: h }, props.style]}>
        <Schematic
          pickup={props.pickup}
          dropoff={props.dropoff}
          courier={props.courier}
          status={props.status}
          height={h}
        />
      </View>
    );
  }
  return <GoogleMap {...props} />;
}

function GoogleMap({ pickup, dropoff, courier, trail, status, height = 220, style }) {
  const host = useRef(null);
  const scene = useRef({ map: null, markers: {}, line: null, fitted: '' });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!mapsReady());
  const { resolved } = useTheme();

  useEffect(() => {
    if (!mapsReady()) return undefined;
    let alive = true;
    loadGoogleMaps(mapsKey())
      .then((maps) => {
        if (!alive || !host.current) return;
        const first = courier || pickup || dropoff;
        scene.current.map = new maps.Map(host.current, {
          ...MAP_OPTIONS(resolved === 'dark'),
          center: first ? { lat: first.lat, lng: first.lng } : undefined,
          zoom: 14
        });
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      scene.current = { map: null, markers: {}, line: null, fitted: '' };
    };
    // The map instance is created once; theme and data are applied by the effects below.
  }, []);

  useEffect(() => {
    const map = scene.current.map;
    if (map && window.google?.maps) {
      map.setOptions({ styles: MAP_OPTIONS(resolved === 'dark').styles, backgroundColor: resolved === 'dark' ? '#000000' : '#ffffff' });
    }
  }, [resolved, ready]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = scene.current.map;
    if (!ready || !maps || !map) return;

    const points = [
      pickup && { key: 'pickup', ...pickup, color: colors.ink, letter: 'K', glyph: colors.paper },
      dropoff && { key: 'dropoff', ...dropoff, color: colors.accent, letter: 'D', glyph: '#ffffff' },
      courier && { key: 'courier', ...courier, color: colors.accent, dot: true }
    ].filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));

    const keep = new Set(points.map((p) => p.key));
    Object.entries(scene.current.markers).forEach(([key, marker]) => {
      if (!keep.has(key)) {
        marker.setMap(null);
        delete scene.current.markers[key];
      }
    });

    const bounds = new maps.LatLngBounds();
    points.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      bounds.extend(position);
      const existing = scene.current.markers[point.key];
      if (existing) {
        existing.setPosition(position);
      } else {
        scene.current.markers[point.key] = new maps.Marker({
          map,
          position,
          title: point.label || point.key,
          icon: point.dot
            ? { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: colors.accent, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }
            : {
                path: 'M0,0 C0,0 -9,-12 -9,-17 A9,9 0 1,1 9,-17 C9,-12 0,0 0,0 Z',
                fillColor: point.color,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 1.15,
                anchor: new maps.Point(0, 0),
                label: { text: point.letter, color: point.glyph, fontSize: 10, fontWeight: '700' }
              }
        });
      }
    });

    const path = (trail || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({ lat: p.lat, lng: p.lng }));
    if (path.length < 2 && pickup && courier) path.push({ lat: pickup.lat, lng: pickup.lng }, { lat: courier.lat, lng: courier.lng });
    if (scene.current.line) scene.current.line.setMap(null);
    scene.current.line = path.length > 1
      ? new maps.Polyline({ map, path, strokeColor: colors.accent, strokeOpacity: 0.9, strokeWeight: 3 })
      : null;

    const signature = `${pickup?.lat},${pickup?.lng}|${dropoff?.lat},${dropoff?.lng}`;
    if (signature !== scene.current.fitted) {
      scene.current.fitted = signature;
      if (!path.length && bounds.isEmpty()) map.setCenter({ lat: points[0]?.lat ?? 9.01, lng: points[0]?.lng ?? 38.75 });
      else map.fitBounds(bounds, 40);
    } else if (courier) {
      map.panTo({ lat: courier.lat, lng: courier.lng });
    }
  }, [ready, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, courier?.lat, courier?.lng, trail, status]);

  if (failed) {
    const h = schematicHeight(height);
    return (
      <View style={[frame, { height: h }, style]}>
        <Schematic pickup={pickup} dropoff={dropoff} courier={courier} status={status} height={h} />
      </View>
    );
  }

  return <View ref={host} style={[frame, { height }, style]} />;
}

const frame = { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.tint };
