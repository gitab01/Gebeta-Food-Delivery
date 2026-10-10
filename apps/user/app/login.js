import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '../../shared/session';
import { colors, space, type } from '../../shared/theme';
import { Button, Field, Notice, Screen } from '../../shared/ui';

export default function Login() {
  const { login } = useSession();
  const router = useRouter();
  const [phone, setPhone] = useState('0922222201');
  const [password, setPassword] = useState('gebeta123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(phone.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: space.xxl }}>
          <Text style={type.eyebrow}>Gebeta</Text>
          <Text style={[type.h1, { marginTop: space.sm }]}>Food, tracked honestly.</Text>
          <Text style={[type.small, { marginTop: space.sm, marginBottom: space.xl }]}>
            Sign in with your phone number to order and follow the courier in real time.
          </Text>

          <Notice text={error} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Password" value={password} onChangeText={setPassword} secure />
          <Button label="Sign in" onPress={submit} loading={busy} />

          <View style={styles.alt}>
            <Text style={type.small}>New to Gebeta? </Text>
            <Link href="/register" style={styles.link}>
              Create an account
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: space.lg },
  alt: { flexDirection: 'row', justifyContent: 'center', marginTop: space.lg },
  link: { color: colors.accentInk, fontWeight: '700' }
});
