import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '../../shared/session';
import { colors, space, type } from '../../shared/theme';
import { Button, Field, Notice, Screen } from '../../shared/ui';

// Addis Ababa blocks the seed data lives around; picking one avoids asking for a
// GPS permission just to place a first order.
const PRESETS = [
  { label: 'Bole', line: 'Bole Medhanialem, near the airport road', lat: 8.9973, lng: 38.7873 },
  { label: 'Piassa', line: 'Piassa, Ras Makonnen Rd', lat: 9.034, lng: 38.72 },
  { label: 'Kazanchis', line: 'Kazanchis, Africa Ave', lat: 8.994, lng: 38.79 }
];

export default function Register() {
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: space.xxl }}>
          <Text style={type.eyebrow}>New account</Text>
          <Text style={[type.h1, { marginVertical: space.sm }]}>Two minutes to your first order.</Text>

          <Notice text={error} />
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09…" />
          <Field label="Password" value={password} onChangeText={setPassword} secure placeholder="at least 6 characters" />

          <Text style={[type.eyebrow, { marginBottom: space.sm }]}>Delivery area</Text>
          <View style={styles.presets}>
            {PRESETS.map((p) => (
              <Text
                key={p.label}
                onPress={() => setPreset(p)}
                style={[styles.preset, preset.label === p.label && styles.presetOn]}
              >
                {p.label}
              </Text>
            ))}
          </View>
          <Text style={[type.small, { marginBottom: space.md }]}>{preset.line}</Text>

          <Button label="Create account" onPress={submit} loading={busy} />
          <View style={styles.alt}>
            <Text style={type.small}>Already registered? </Text>
            <Link href="/login" style={styles.link}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  preset: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    fontSize: 14,
    color: colors.muted
  },
  presetOn: { borderColor: colors.ink, color: colors.ink, fontWeight: '700', backgroundColor: colors.tint },
  alt: { flexDirection: 'row', justifyContent: 'center', marginTop: space.lg },
  link: { color: colors.accentInk, fontWeight: '700' }
});
