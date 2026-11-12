import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { colors, space, type, useStyles } from './theme';

/** The gebeta artwork's own colours — fixed, so the mark never repaints with the theme. */
const CREAM = '#f4e7d1';
const INK_NAVY = '#1e2a55';
const RUST = '#d9542b';
const MOUND = '#c9975f';
const MOUND_INK = '#8c6239';
const GREEN = '#3f7a46';

/**
 * The gebeta itself: the woven basket the food is served from. A knob on a short neck,
 * three dome bands that widen as they fall, and a two-band pedestal — drawn as thick
 * rounded strands so the weave still reads at 20px. Vector, so it repaints with the theme.
 */
export function Logo({ size = 34, muted }) {
  const stroke = muted ? colors.line : colors.gold;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel="Gebeta">
      <G stroke={stroke} strokeWidth={3.1} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Ellipse cx="20" cy="4.6" rx="3" ry="1.7" />
        <Path d="M16.9 7.1L15.4 10M23.1 7.1L24.6 10" />
        <Path d="M12 15.2Q20 9.8 28 15.2" />
        <Path d="M8.6 20.6Q20 13.2 31.4 20.6" />
        <Path d="M5.6 26.2Q20 16 34.4 26.2" />
        <Path d="M9.2 31.6Q20 34.8 30.8 31.6" />
        <Path d="M13 36.6Q20 39 27 36.6" />
      </G>
    </Svg>
  );
}

/** Two wisps off the injera, each taking a different slice of one looping driver. */
const STEAM = [
  { d: 'M20 17c-3-3 3-5.5 0-8.5', span: [0, 0.62] },
  { d: 'M29.5 16c3-3-3-5.5 0-8.5', span: [0.3, 0.95] }
];

/**
 * The full-colour gebeta from the reference illustration: a swirl mound of injera in a
 * cream basket banded with rust and navy triangles over a green foot, its conical lid
 * propped open against the rim. It carries its own colours in both modes, so use it
 * centred and large — on the auth screens and the loader. Below ~56px use `Logo`.
 * It settles in once and then keeps steaming; the steam is theme ink, not artwork ink,
 * so it reads on white and on black alike.
 */
export function BasketMark({ size = 96 }) {
  const line = { stroke: INK_NAVY, strokeWidth: 1.6, strokeLinejoin: 'round' };
  const enter = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: false })
    );
    loop.start();
    return () => {
      loop.stop();
      enter.stopAnimation();
      drift.stopAnimation();
    };
  }, [enter, drift]);

  /** A wisp fades in, rides up and fades out inside its own slice of the loop. */
  const rise = ([from, to]) => ({
    transform: [
      {
        translateY: drift.interpolate({
          inputRange: [from, to],
          outputRange: [size * 0.09, -size * 0.12],
          extrapolate: 'clamp'
        })
      }
    ]
  });

  const fade = ([from, to]) =>
    drift.interpolate({
      inputRange: [from, from + (to - from) * 0.4, to],
      outputRange: [0, 0.6, 0],
      extrapolate: 'clamp'
    });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }
        ]
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Gebeta">
      <Path d="M12 33 Q14.5 21.5 24.5 19 Q34 17 40 23.5 Q45.5 28 48.5 33 Z" fill={MOUND} stroke={MOUND_INK} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M18.5 32q1.5-6 5.5-5.2t3 5.8M28 31q1.5-6 5.5-5.2t3 5.8M23 24.5q1.5-4.5 4.8-4t2.4 4.8" fill="none" stroke={MOUND_INK} strokeWidth={1.3} strokeLinecap="round" />
      <G transform="translate(41.5 30) rotate(32)">
        <Path d="M-13 0 L13 0 L0 -16 Z" fill={CREAM} {...line} />
        <Path d="M-11.0 0.0 L11.0 0.0 L11.0 0.0 L9.2 -5.0 L7.3 0.0 L5.5 -5.0 L3.7 0.0 L1.8 -5.0 L-0.0 0.0 L-1.8 -5.0 L-3.7 0.0 L-5.5 -5.0 L-7.3 0.0 L-9.2 -5.0 Z" fill={RUST} />
        <Path d="M-13 0 Q0 4 13 0" fill={CREAM} {...line} />
        <Circle cx="0" cy="-18.5" r="2.6" fill={CREAM} {...line} />
      </G>
      <Path d="M9 33 L17 53 Q32 59 47 53 L55 33 Z" fill={CREAM} stroke={INK_NAVY} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M9 30.5 H55 V35 H9 Z" fill={CREAM} stroke={INK_NAVY} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M11.0 35.0 L53.0 35.0 L53.0 35.0 L50.7 41.0 L48.3 35.0 L46.0 41.0 L43.7 35.0 L41.3 41.0 L39.0 35.0 L36.7 41.0 L34.3 35.0 L32.0 41.0 L29.7 35.0 L27.3 41.0 L25.0 35.0 L22.7 41.0 L20.3 35.0 L18.0 41.0 L15.7 35.0 L13.3 41.0 Z" fill={RUST} />
      <Path d="M15.0 49.5 L17.8 44.0 L20.7 49.5 Z M20.7 49.5 L23.5 44.0 L26.3 49.5 Z M26.3 49.5 L29.2 44.0 L32.0 49.5 Z M32.0 49.5 L34.8 44.0 L37.7 49.5 Z M37.7 49.5 L40.5 44.0 L43.3 49.5 Z M43.3 49.5 L46.2 44.0 L49.0 49.5 Z" fill={INK_NAVY} />
      <Path d="M16.4 49.5 H47.6 L46 53 Q32 58.6 18 53 Z" fill={GREEN} stroke={INK_NAVY} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>

      {STEAM.map((w) => (
        <Animated.View key={w.d} style={[StyleSheet.absoluteFill, { opacity: fade(w.span) }, rise(w.span)]}>
          <Svg width={size} height={size} viewBox="0 0 64 64">
            <Path d={w.d} fill="none" stroke={colors.muted} strokeWidth={1.7} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
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
    lockup: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    wordmark: { fontWeight: '800', letterSpacing: -0.8, color: colors.ink }
  });
