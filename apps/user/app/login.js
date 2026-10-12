import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '../../shared/session';
import { colors, space, type, useStyles } from '../../shared/theme';
import { Button, Field, Notice, Screen } from '../../shared/ui';
import { Logo } from '../../shared/brand';
import { useI18n } from '../../shared/lang';

export default function Login() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
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
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.form}>
            <Logo size={46} />
            <Text style={[type.eyebrow, { marginTop: space.lg }]}>{t('app.name')}</Text>
            <Text style={[type.h1, { marginTop: space.xs }]}>{t('app.tagline')}</Text>
            <Text style={[type.small, styles.intro]}>{t('auth.userIntro')}</Text>

            <Notice text={error} />
            <Field icon="phone" label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Field icon="lock" label={t('auth.password')} value={password} onChangeText={setPassword} secure />
            <Button label={t('auth.signIn')} onPress={submit} loading={busy} icon="next" />

            <View style={styles.alt}>
              <Text style={type.small}>{t('auth.newHere')} </Text>
              <Link href="/register" style={styles.link}>
                {t('auth.register')}
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
    intro: { marginTop: space.sm, marginBottom: space.xl, lineHeight: 21 },
    alt: { flexDirection: 'row', justifyContent: 'center', marginTop: space.lg },
    link: { color: colors.accentInk, fontWeight: '700' }
  });
