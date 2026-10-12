import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useI18n } from '../../shared/lang';
import { useSession } from '../../shared/session';
import { colors, space, type, useStyles } from '../../shared/theme';
import { Logo } from '../../shared/brand';
import { Button, Choices, Field, Notice, Screen } from '../../shared/ui';

const VEHICLES = ['foot', 'bicycle', 'motorbike', 'car'];

export default function Register() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { register } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicle, setVehicle] = useState('motorbike');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await register({ phone: phone.trim(), name: name.trim(), password, role: 'courier', vehicle });
      router.replace('/');
    } catch (err) {
      setError(err.code === 'PHONE_TAKEN' ? t('register.phoneTaken') : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Logo size={40} />
        <Text style={[type.eyebrow, { marginTop: space.lg }]}>{t('register.courierEyebrow')}</Text>
        <Text style={[type.h1, styles.title]}>{t('register.courierTitle')}</Text>
        <Text style={[type.small, styles.intro]}>{t('register.courierIntro')}</Text>

        <Notice text={error} />
        <Field icon="person" label={t('auth.name')} value={name} onChangeText={setName} />
        <Field icon="phone" label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t('register.phoneHint')} />
        <Field icon="lock" label={t('auth.password')} value={password} onChangeText={setPassword} secure placeholder={t('register.passwordHint')} />

        <Text style={[type.eyebrow, { marginBottom: space.sm }]}>{t('register.vehicle')}</Text>
        <Choices
          value={vehicle}
          onChange={setVehicle}
          options={VEHICLES.map((value) => ({ value, label: t(`vehicle.${value}`) }))}
        />
        <Text style={[type.small, styles.note]}>{t('register.vehicleFoot')}</Text>

        <Button label={t('register.courierAccount')} icon="check" onPress={submit} loading={busy} />

        <Text style={styles.alt}>
          <Text style={type.small}>{t('register.haveAccount')} </Text>
          <Link href="/login" style={styles.link}>
            {t('auth.signIn')}
          </Link>
        </Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.xxl, paddingBottom: space.xxl },
    title: { marginTop: space.sm, marginBottom: space.lg },
    intro: { marginBottom: space.xl, lineHeight: 21 },
    note: { marginTop: space.md, marginBottom: space.xl },
    alt: { textAlign: 'center', marginTop: space.lg },
    link: { color: colors.accentInk, fontWeight: '700' }
  });
