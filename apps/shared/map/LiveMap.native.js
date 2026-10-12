import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, radius, space, useStyles } from '../theme';
import { mapsReady, useMapsOn } from './config';
import { Icon } from '../brand';
import { useI18n } from '../lang';
import { Schematic, schematicHeight } from './Schematic';

export function LiveMap(props) {
  const styles = useStyles(makeStyles);
  const on = useMapsOn();
  if (!on) {
    const h = schematicHeight(props.height);
    return (
      <View style={[styles.frame, { height: h }, props.style]}>
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

/**
 * The native renderer. Google tiles are requested on Android where the key is compiled
 * into the app; if the provider is not actually available - Expo Go on a machine without
 * a bundled key, for instance - the map would render blank, so the view falls back to the
 * schematic rather than showing an empty rectangle.
 */
function GoogleMap({ pickup, dropoff, courier, trail, status, height = 220, style, onRecenter }) {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const map = useRef(null);
  const fitted = useRef('');
  const [broken, setBroken] = useState(!mapsReady());

  const points = [pickup, dropoff, courier].filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const path = (trail || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  useEffect(() => {
    if (broken || !map.current || !points.length) return;
    const signature = `${pickup?.lat},${pickup?.lng}|${dropoff?.lat},${dropoff?.lng}`;
    if (signature === fitted.current) {
      if (courier) {
        map.current.animateToRegion(
          { latitude: courier.lat, longitude: courier.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
          600
        );
      }
      return;
    }
    fitted.current = signature;
    map.current.fitToCoordinates(points, {
      edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
      animated: true
    });
  }, [broken, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, courier?.lat, courier?.lng, points.length]);

  if (broken) {
    return <Schematic pickup={pickup} dropoff={dropoff} courier={courier} status={status} height={schematicHeight(height)} />;
  }

  const recenter = () => {
    fitted.current = '';
    if (map.current && points.length) {
      map.current.fitToCoordinates(points, {
        edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
        animated: true
      });
    }
    onRecenter?.();
  };

  return (
    <View style={[styles.frame, { height }, style]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: points[0]?.lat ?? 9.0107,
          longitude: points[0]?.lng ?? 38.7578,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
        mapType="standard"
        zoomEnabled
        scrollEnabled
        pitchEnabled={false}
        toolbarEnabled={false}
        loadingEnabled
        onProviderChange={(e) => {
          if (Platform.OS === 'android' && e?.provider !== 'google') setBroken(true);
        }}
        onError={() => setBroken(true)}
      >
        {path.length > 1 ? <Polyline coordinates={path} strokeColor={colors.accent} strokeWidth={3} /> : null}
        {pickup ? (
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title={pickup.label || t('track.kitchen')} anchor={{ x: 0.5, y: 1 }}>
            <View style={[styles.pin, { backgroundColor: colors.ink }]}>
              <Text style={[styles.pinGlyph, { color: colors.paper }]}>K</Text>
            </View>
          </Marker>
        ) : null}
        {dropoff ? (
          <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} title={dropoff.label || t('track.dropoff')} anchor={{ x: 0.5, y: 1 }}>
            <View style={[styles.pin, { backgroundColor: colors.accent }]}>
              <Text style={styles.pinGlyph}>D</Text>
            </View>
          </Marker>
        ) : null}
        {courier ? (
          <Marker coordinate={{ latitude: courier.lat, longitude: courier.lng }} title={courier.label || t('track.courier')} flat anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.courier}>
              <Icon name="navigate" size={13} color={colors.onAccent} />
            </View>
          </Marker>
        ) : null}
      </MapView>
      <Pressable onPress={recenter} style={styles.recenter} accessibilityRole="button" accessibilityLabel={t('track.recenter')}>
        <Icon name="pin-location" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    frame: {
      overflow: 'hidden',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.tint
    },
    pin: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#ffffff'
    },
    pinGlyph: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    courier: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#ffffff'
    },
    recenter: {
      position: 'absolute',
      right: space.md,
      bottom: space.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center'
    }
  });
