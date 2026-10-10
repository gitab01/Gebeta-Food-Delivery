import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '../../shared/session';
import { colors, radius, space, type } from '../../shared/theme';
import { Button, Field, Notice, Screen } from '../../shared/ui';

const VEHICLES = ['motorbike', 'bicycle', 'car', 'walk'];

export default function Register() {
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
      setError(err.code === 'PHONE_TAKEN' ? 'That phone number already has an account.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <Text style={type.eyebrow}>Work with Gebeta</Text>
        <Text style={[type.h1, { marginTop: space.sm, marginBottom: space.lg }]}>Register as a courier.</Text>
        <Text style={[type.small, { marginBottom: space.xl }]}>
          You start offline. Go online from the Jobs tab and offers near your position begin arriving. Restaurant and
          operator accounts are provisioned by the marketplace, not self-served.
        </Text>

        <Notice text={error} />
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09xxxxxxxx" />
        <Field label="Password" value={password} onChangeText={setPassword} secure placeholder="at least 6 characters" />

        <Text style={[type.eyebrow, { marginBottom: space.sm }]}>Vehicle</Text>
        <View style={styles.pick}>
          {VEHICLES.map((v) => (
            <Button
              key={v}
              label={v}
              variant={v === vehicle ? 'primary' : 'ghost'}
              onPress={() => setVehicle(v)}
              style={styles.pickButton}
            />
          ))}
        </View>
        <Text style={[type.small, { marginTop: space.md, marginBottom: space.xl }]}>
          Distance to a pickup is converted into minutes at a speed that depends on how you ride.
        </Text>

        <Button label="Create courier account" onPress={submit} loading={busy} />

        <View style={styles.alt}>
          <Text style={type.small}>Already riding? </Text>
          <Link href="/login" style={styles.link}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pickButton: { flex: 1, minWidth: 130, borderRadius: radius.md },
  alt: { flexDirection: 'row', justifyContent: 'center', marginTop: space.lg },
  link: { color: colors.accentInk, fontWeight: '700' }
});
