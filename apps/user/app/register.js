import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '../../shared/session';
import { colors, radius, space, type, useStyles } from '../../shared/theme';
import { Button, Field, Notice, Screen } from '../../shared/ui';
import { useI18n } from '../../shared/lang';

// Addis Ababa blocks the seed data lives around; picking one avoids asking for a
// GPS permission just to place a first order.
const PRESETS = [
  { label: 'Bole', line: 'Bole Medhanialem, near the airport road', lat: 8.9973, lng: 38.7873 },
  { label: 'Piassa', line: 'Piassa, Ras Makonnen Rd', lat: 9.034, lng: 38.72 },
  { label: 'Kazanchis', line: 'Kazanchis, Africa Ave', lat: 8.994, lng: 38.79 }
];

export default function Register() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { register } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [preset, setPreset] = useState(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        role: 'customer',
        address: { label: preset.label, line: preset.line, lat: preset.lat, lng: preset.lng }
      });
      router.replace('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.form}>
            <Text style={type.eyebrow}>{t('register.eyebrow')}</Text>
            <Text style={[type.h1, styles.title]}>{t('register.title')}</Text>
            <Text style={[type.small, styles.intro]}>{t('auth.registerIntro')}</Text>

            <Notice text={error} />
            <Field icon="person" label={t('auth.name')} value={name} onChangeText={setName} />
            <Field
              icon="phone"
              label={t('auth.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder={t('register.phoneHint')}
            />
            <Field
              icon="lock"
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secure
              placeholder={t('register.passwordHint')}
            />

            <Text style={[type.eyebrow, styles.areaLabel]}>{t('register.area')}</Text>
            <View style={styles.presets}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  accessibilityRole="button"
                  onPress={() => setPreset(p)}
                  style={[styles.preset, preset.label === p.label && styles.presetOn]}
                >
                  <Text style={[styles.presetText, preset.label === p.label && styles.presetTextOn]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[type.small, styles.presetLine]}>{preset.line}</Text>

            <Button label={t('auth.register')} onPress={submit} loading={busy} icon="next" />
            <View style={styles.alt}>
              <Text style={type.small}>{t('register.haveAccount')} </Text>
              <Link href="/login" style={styles.link}>
                {t('auth.signIn')}
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space.xxl },
    form: { width: '100%', maxWidth: 400, alignSelf: 'center' },
    title: { marginTop: space.xs },
    intro: { marginBottom: space.xl, lineHeight: 21 },
    areaLabel: { marginTop: space.md, marginBottom: space.sm },
    presets: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
    preset: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8
    },
    presetOn: { borderColor: colors.ink, backgroundColor: colors.tint },
    presetText: { fontSize: 14, color: colors.muted },
    presetTextOn: { color: colors.ink, fontWeight: '700' },
    presetLine: { marginTop: space.sm, marginBottom: space.md },
    alt: { flexDirection: 'row', justifyContent: 'center', marginTop: space.lg },
    link: { color: colors.accentInk, fontWeight: '700' }
  });
