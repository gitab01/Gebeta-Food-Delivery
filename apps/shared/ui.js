import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space, statusColor, type } from './theme';
import { etb } from './api';

/** Small enough to share, explicit enough that neither app needs a component library. */

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style, onPress }) {
  const body = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }) {
  const blocked = disabled || loading;
  const palette =
    variant === 'ghost'
      ? { bg: 'transparent', fg: colors.ink, border: colors.line }
      : variant === 'danger'
        ? { bg: colors.accent, fg: '#ffffff', border: colors.accent }
        : { bg: colors.ink, fg: '#ffffff', border: colors.ink };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={blocked ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: blocked ? 0.55 : pressed ? 0.85 : 1 },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, secure, keyboardType, placeholder, multiline, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={type.eyebrow}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        style={[styles.input, multiline && styles.inputMulti]}
      />
    </View>
  );
}

export function StatusChip({ status, label }) {
  const tone = statusColor(status);
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.fg + '33' }]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.chipText, { color: tone.fg }]}>{label || status}</Text>
    </View>
  );
}

export function Chip({ label, tone = 'neutral', style }) {
  const map = {
    neutral: { fg: colors.muted, bg: colors.tint },
    accent: { fg: colors.accentInk, bg: colors.accentTint },
    green: { fg: colors.green, bg: colors.greenTint },
    amber: { fg: colors.amber, bg: colors.amberTint }
  };
  const t = map[tone] || map.neutral;
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.chipText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Money({ cents, size = 'body', muted }) {
  const fontSize = size === 'big' ? 24 : size === 'small' ? 13 : 15;
  return (
    <Text style={{ fontSize, fontWeight: '700', color: muted ? colors.muted : colors.ink }}>
      {etb(cents)}
    </Text>
  );
}

export function Row({ label, value, style }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={type.small}>{label}</Text>
      <Text style={[type.body, { fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

export function Empty({ title, body }) {
  return (
    <View style={styles.empty}>
      <Text style={type.h2}>{title}</Text>
      {body ? <Text style={[type.small, { marginTop: space.sm }]}>{body}</Text> : null}
    </View>
  );
}

export function Notice({ tone = 'error', text }) {
  if (!text) return null;
  const bg = tone === 'success' ? colors.greenTint : colors.accentTint;
  const fg = tone === 'success' ? colors.green : colors.accentInk;
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: fg + '33' }]}>
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
      <Text style={[type.small, { marginTop: space.sm }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: space.lg },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg
  },
  pressed: { opacity: 0.92 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg
  },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  field: { gap: 6, marginBottom: space.md },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper
  },
  inputMulti: { minHeight: 84, textAlignVertical: 'top', paddingTop: space.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 6 },
  empty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: space.xl },
  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md
  },
  loading: { paddingVertical: 40, alignItems: 'center' }
});

export const isWeb = Platform.OS === 'web';
