import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors, radius, space, statusColor, type, useStyles, useTheme } from './theme';
import { MAX_CONTENT, MAX_GRID, useViewport } from './responsive';
import { Icon } from './brand';
import { LANGS, useI18n } from './lang';
import { etb } from './api';

/** Small enough to share, explicit enough that neither app needs a component library. */

export function Screen({ children, style, wide }) {
  const styles = useStyles(makeStyles);
  const { gutter } = useViewport();
  return (
    <View style={[styles.screen, { paddingHorizontal: gutter }]}>
      <View style={[styles.content, wide && { maxWidth: MAX_GRID }, style]}>{children}</View>
    </View>
  );
}

export function Card({ children, style, onPress, padded = true }) {
  const styles = useStyles(makeStyles);
  const body = <View style={[styles.card, !padded && { padding: 0 }, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, style, narrow }) {
  const styles = useStyles(makeStyles);
  const blocked = disabled || loading;
  const palette =
    variant === 'ghost'
      ? { bg: 'transparent', fg: colors.ink, border: colors.line }
      : variant === 'danger'
        ? { bg: colors.accent, fg: colors.onAccent, border: colors.accent }
        : variant === 'quiet'
          ? { bg: colors.tint, fg: colors.ink, border: colors.tint }
          : { bg: colors.ink, fg: colors.paper, border: colors.ink };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={blocked ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        narrow && styles.buttonNarrow,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: blocked ? 0.55 : pressed ? 0.85 : 1 },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.buttonRow}>
          {icon ? <Icon name={icon} size={17} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, secure, keyboardType, placeholder, multiline, icon, style }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={type.eyebrow}>{label}</Text>
      <View style={styles.fieldRow}>
        {icon ? <Icon name={icon} size={18} color={colors.faint} style={{ marginRight: space.sm }} /> : null}
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
    </View>
  );
}

export function StatusChip({ status, label }) {
  const styles = useStyles(makeStyles);
  const tone = statusColor(status);
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.fg + '33' }]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.chipText, { color: tone.fg }]} numberOfLines={1}>
        {label || status}
      </Text>
    </View>
  );
}

export function Chip({ label, tone = 'neutral', icon, style }) {
  const styles = useStyles(makeStyles);
  const map = {
    neutral: { fg: colors.muted, bg: colors.tint },
    accent: { fg: colors.accentInk, bg: colors.accentTint },
    green: { fg: colors.green, bg: colors.greenTint },
    amber: { fg: colors.amber, bg: colors.amberTint }
  };
  const t = map[tone] || map.neutral;
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }, style]}>
      {icon ? <Icon name={icon} size={13} color={t.fg} /> : null}
      <Text style={[styles.chipText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Money({ cents, size = 'body', muted }) {
  const styles = useStyles(makeStyles);
  const fontSize = size === 'big' ? 24 : size === 'small' ? 13 : 15;
  return (
    <Text style={[styles.money, { fontSize, color: muted ? colors.muted : colors.ink }]}>{etb(cents)}</Text>
  );
}

export function Row({ label, value, style }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.row, style]}>
      <Text style={type.small}>{label}</Text>
      <Text style={[type.body, { fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

/** A tappable settings line: icon, label, current value, chevron. */
export function Setting({ icon, label, value, onPress, right }) {
  const styles = useStyles(makeStyles);
  const body = (
    <View style={styles.setting}>
      {icon ? (
        <View style={styles.settingIcon}>
          <Icon name={icon} size={17} color={colors.muted} />
        </View>
      ) : null}
      <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
      {right}
      {value ? (
        <Text style={[type.small, { maxWidth: 170 }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Icon name="next" size={18} color={colors.faint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.settingWrap, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

/** The control behind both preferences: appearance mode and language. */
export function Segmented({ options, value, onChange, style }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {option.icon ? <Icon name={option.icon} size={15} color={active ? colors.ink : colors.muted} /> : null}
            <Text style={[styles.segmentText, active && { color: colors.ink, fontWeight: '700' }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A wrapping option list: wider than `Segmented`, so long native names still fit. */
export function Choices({ options, value, onChange, style }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.choices, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.choice, active && styles.choiceActive]}
          >
            {active ? <Icon name="check" size={14} color={colors.ink} /> : null}
            <Text style={[styles.choiceText, active && styles.choiceTextActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A labelled switch with the reason underneath, used for the two app preferences. */
export function Toggle({ label, foot, value, onValueChange, icon }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.setting}>
      {icon ? (
        <View style={styles.settingIcon}>
          <Icon name={icon} size={17} color={colors.muted} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={type.body}>{label}</Text>
        {foot ? (
          <Text style={[type.small, { marginTop: 2 }]}>{foot}</Text>
        ) : null}
      </View>
      <Switch trackColor={{ false: colors.line, true: colors.accent }} thumbColor={colors.paper} value={Boolean(value)} onValueChange={onValueChange} />
    </View>
  );
}

/**
 * The two preferences both apps expose. They write straight through to the theme and
 * language providers, so a tap repaints or re-labels the whole app with no save step.
 */
export function Preferences() {
  const { mode, setMode } = useTheme();
  const { lang, setLang, t } = useI18n();
  return (
    <View>
      <Text style={type.eyebrow}>{t('set.appearance')}</Text>
      <Segmented
        style={{ marginTop: space.sm }}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'system', label: t('account.system'), icon: 'system' },
          { value: 'light', label: t('account.light'), icon: 'light' },
          { value: 'dark', label: t('account.dark'), icon: 'dark' }
        ]}
      />
      <Text style={[type.eyebrow, { marginTop: space.lg }]}>{t('set.language')}</Text>
      <Choices
        style={{ marginTop: space.sm }}
        value={lang}
        onChange={setLang}
        options={LANGS.map((l) => ({ value: l.code, label: l.native }))}
      />
    </View>
  );
}

export function Header({ title, subtitle, onBack, right }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={styles.back}>
          <Icon name="back" size={20} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={type.h2} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.small} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Empty({ icon = 'store', title, body }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={colors.muted} />
      </View>
      <Text style={[type.h2, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.small, { marginTop: space.sm, textAlign: 'center' }]}>{body}</Text> : null}
    </View>
  );
}

export function Notice({ tone = 'error', text, icon = 'close' }) {
  const styles = useStyles(makeStyles);
  if (!text) return null;
  const bg = tone === 'success' ? colors.greenTint : colors.accentTint;
  const fg = tone === 'success' ? colors.green : colors.accentInk;
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: fg + '33' }]}>
      <Icon name={tone === 'success' ? 'check' : icon} size={16} color={fg} />
      <Text style={{ color: fg, fontSize: 14, lineHeight: 20, flex: 1 }}>{text}</Text>
    </View>
  );
}

export function Loading({ label }) {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[type.small, { marginTop: space.sm }]}>{label || t('common.loading')}</Text>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper },
    content: { flex: 1, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
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
    buttonNarrow: { minHeight: 42, paddingHorizontal: space.md },
    buttonRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    field: { gap: 6, marginBottom: space.md },
    fieldRow: { flexDirection: 'row', alignItems: 'center' },
    input: {
      flex: 1,
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
    money: { fontWeight: '700' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 6 },
    setting: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
    settingWrap: { borderBottomWidth: 1, borderBottomColor: colors.line },
    settingIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint
    },
    segmented: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: 3,
      gap: 3
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: radius.sm
    },
    segmentActive: { backgroundColor: colors.tint },
    segmentText: { fontSize: 12, color: colors.muted },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    choiceActive: { borderColor: colors.ink, backgroundColor: colors.tint },
    choiceText: { fontSize: 13, color: colors.muted },
    choiceTextActive: { color: colors.ink, fontWeight: '700' },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
    back: { width: 34, alignItems: 'center' },
    empty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: space.xl, gap: space.md },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: space.md,
      marginBottom: space.md
    },
    loading: { paddingVertical: 40, alignItems: 'center' }
  });

export const isWeb = Platform.OS === 'web';
