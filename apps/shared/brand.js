import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, space, type, useStyles } from './theme';

/**
 * The mark is the gebeta itself: a round serving platter seen from above, with the
 * shared portion filled in. It is built from Views so it renders identically in
 * Expo Go, in the web bundle and in the admin, and stays crisp at 20px.
 */
export function Logo({ size = 34, muted }) {
  const styles = useStyles(makeStyles);
  const ring = size * 0.1;
  return (
    <View
      style={[
        styles.platter,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(2, ring),
          borderColor: muted ? colors.line : colors.ink
        }
      ]}
      accessibilityIgnoresInvertColors
    >
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size * 0.42,
          backgroundColor: muted ? colors.line : colors.accent
        }}
      />
    </View>
  );
}

/** Logo + product name, used on the auth screens and the admin header. */
export function Lockup({ product, size = 40, subtitle }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.lockup}>
      <Logo size={size} />
      <View>
        <Text style={[styles.wordmark, { fontSize: size * 0.52 }]}>
          {'Gebeta'}
          {product ? <Text style={{ color: colors.muted }}> {product}</Text> : null}
        </Text>
        {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/**
 * One icon vocabulary for both apps. Names are ours, not the font's, so swapping the
 * underlying set later touches this file only.
 */
const GLYPHS = {
  near: 'map-marker-radius-outline',
  orders: 'clipboard-text-outline',
  account: 'account-circle-outline',
  jobs: 'motorbike',
  earnings: 'cash-multiple',
  profile: 'card-account-details-outline',
  back: 'arrow-left',
  next: 'chevron-right',
  add: 'plus',
  cart: 'cart-outline',
  phone: 'cellphone',
  lock: 'lock-outline',
  person: 'account-outline',
  language: 'translate',
  light: 'weather-sunny',
  dark: 'weather-night',
  system: 'cellphone-link',
  check: 'check-circle-outline',
  clock: 'clock-outline',
  store: 'storefront-outline',
  navigate: 'navigation-variant-outline',
  offline: 'wifi-off',
  pin: 'map-marker-outline',
  logout: 'logout',
  refresh: 'refresh',
  close: 'close',
  'pin-location': 'crosshairs-gps',
  money: 'cash',
  fire: 'fire',
  card: 'credit-card-outline',
  wallet: 'wallet-outline',
  settings: 'cog-outline',
  trash: 'trash-can-outline',
  bell: 'bell-outline',
  shield: 'shield-check-outline',
  chart: 'chart-line',
  dashboard: 'view-dashboard-outline',
  map: 'map-outline',
  users: 'account-group-outline',
  car: 'car-outline',
  motorbike: 'motorbike',
  bicycle: 'bike',
  walk: 'walk',
  star: 'star',
  'star-outline': 'star-outline'
};

export function Icon({ name, size = 20, color, style }) {
  const glyph = GLYPHS[name] || name;
  return <MaterialCommunityIcons name={glyph} size={size} color={color || colors.ink} style={style} />;
}

const makeStyles = () =>
  StyleSheet.create({
    platter: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
    lockup: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    wordmark: { fontWeight: '800', letterSpacing: -0.8, color: colors.ink }
  });
