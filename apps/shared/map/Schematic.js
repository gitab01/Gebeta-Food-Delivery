import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type, useStyles } from '../theme';
import { Icon } from '../brand';
import { useI18n } from '../lang';

/**
 * Where the courier is along the kitchen→door line, without a map tile: the reported
 * position is projected onto that line, and with no position yet the status supplies a
 * nominal point. It never invents a location off the route.
 */
const project = (from, to, point) => {
  if (!from || !to || !point) return null;
  const vx = to.lat - from.lat;
  const vy = to.lng - from.lng;
  const wx = point.lat - from.lat;
  const wy = point.lng - from.lng;
  const len = vx * vx + vy * vy;
  if (!len) return null;
  return Math.min(1, Math.max(0, (wx * vx + wy * vy) / len));
};

const NOMINAL = { ASSIGNED: 0.04, PICKED_UP: 0.55, DELIVERED: 0.99, COMPLETED: 1 };

/** Screens size the map for tiles; the diagram is one lane of pins and needs far less. */
export function schematicHeight(requested) {
  return Math.min(requested || 220, 150);
}

export function Schematic({ pickup, dropoff, courier, status, height = 132, compact }) {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const [width, setWidth] = useState(0);

  const ratio = project(pickup, dropoff, courier);
  const progress = ratio ?? NOMINAL[status] ?? 0;
  const pad = 26;
  const x = pad + Math.max(0, width - pad * 2) * progress;
  const showCourier = width && (courier || status === 'ASSIGNED' || status === 'PICKED_UP');

  return (
    <View style={[styles.frame, compact && styles.frameCompact, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.lane, compact && styles.laneCompact]} />
      <View style={[styles.pin, compact && styles.pinCompact, { left: pad }]}>
        <View style={[styles.pinHead, { backgroundColor: colors.ink }]} />
        <Text style={styles.pinLabel} numberOfLines={1}>{pickup?.label || t('track.kitchen')}</Text>
      </View>
      <View style={[styles.pin, compact && styles.pinCompact, { right: pad }]}>
        <View style={[styles.pinHead, { backgroundColor: colors.accent }]} />
        <Text style={styles.pinLabel} numberOfLines={1}>{dropoff?.label || t('track.dropoff')}</Text>
      </View>
      {showCourier ? (
        <View style={[styles.courier, compact && styles.courierCompact, { left: Math.max(pad - 4, x - 26) }]}>
          <View style={styles.courierDot}>
            <Icon name="navigate" size={13} color={colors.onAccent} />
          </View>
          {courier && progress > 0.1 && progress < 0.9 ? (
            <Text style={styles.courierLabel} numberOfLines={1}>{courier.label || t('track.courier')}</Text>
          ) : null}
        </View>
      ) : null}
      {compact ? null : (
        <Text style={styles.updated}>
          {courier?.at
            ? t('track.ping', { time: new Date(courier.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
            : t('track.waiting')}
        </Text>
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    frame: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.lg,
      backgroundColor: colors.paper,
      justifyContent: 'center',
      paddingVertical: space.lg
    },
    frameCompact: { paddingVertical: 0 },
    laneCompact: { top: 24 },
    pinCompact: { top: 20 },
    courierCompact: { top: 13 },
    lane: { position: 'absolute', top: 34, left: 26, right: 26, height: 2, backgroundColor: colors.line },
    pin: { position: 'absolute', top: 30, alignItems: 'center', width: 70 },
    pinHead: { width: 10, height: 10, borderRadius: 5 },
    pinLabel: { ...type.eyebrow, marginTop: 6, fontSize: 10, textAlign: 'center' },
    courier: { position: 'absolute', top: 23, alignItems: 'center', width: 52 },
    courierDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center'
    },
    courierLabel: { ...type.small, fontSize: 10, marginTop: 3, textAlign: 'center' },
    updated: { ...type.mono, position: 'absolute', bottom: 9, left: 14, right: 14, textAlign: 'center' }
  });
