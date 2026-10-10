import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from './theme';

/**
 * A schematic of the route rather than a slippy map: no tiles, no API key, and no
 * vendor account between the demo and a working tracker. The courier dot is the real
 * reported position projected onto the kitchen→door line, so it moves when the
 * courier moves and never invents a location.
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

export function Tracker({ order, height = 132 }) {
  const [width, setWidth] = useState(0);
  const from = order?.restaurantLocation;
  const to = order?.deliveryAddress?.lat != null
    ? { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng }
    : null;
  const ratio = project(from, to, order?.courierLocation?.lat != null ? order.courierLocation : null);
  const t = ratio ?? NOMINAL[order?.status] ?? 0;

  const pad = 26;
  const usable = Math.max(0, width - pad * 2);
  const x = pad + usable * t;

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.lane} />
      <View style={[styles.pin, { left: pad }]}>
        <View style={[styles.pinHead, { backgroundColor: colors.ink }]} />
        <Text style={styles.pinLabel}>Kitchen</Text>
      </View>
      <View style={[styles.pin, { right: pad }]}>
        <View style={[styles.pinHead, { backgroundColor: colors.accent }]} />
        <Text style={styles.pinLabel}>Drop-off</Text>
      </View>
      {width && (order?.courierName || order?.courierLocation?.lat != null) ? (
        <View style={[styles.courier, { left: x - 11 }]}>
          <View style={styles.courierDot}>
            <Text style={styles.courierGlyph}>▲</Text>
          </View>
          <Text style={styles.courierLabel} numberOfLines={1}>
            {order?.courierName || 'Courier'}
          </Text>
        </View>
      ) : null}
      {order?.courierLocation?.at ? (
        <Text style={styles.updated}>
          position {new Date(order.courierLocation.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      ) : (
        <Text style={styles.updated}>waiting for the courier’s first ping</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    paddingVertical: space.lg
  },
  lane: {
    height: 2,
    backgroundColor: colors.line,
    marginHorizontal: 26
  },
  pin: { position: 'absolute', top: 34, alignItems: 'center', width: 76 },
  pinHead: { width: 10, height: 10, borderRadius: 5 },
  pinLabel: { ...type.eyebrow, marginTop: 6, fontSize: 10, textAlign: 'center' },
  courier: { position: 'absolute', top: 22, alignItems: 'center', width: 60 },
  courierDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  courierGlyph: { color: '#ffffff', fontSize: 9 },
  courierLabel: { ...type.small, fontSize: 10, marginTop: 4, textAlign: 'center' },
  updated: { ...type.mono, position: 'absolute', bottom: 10, left: 14 }
});
