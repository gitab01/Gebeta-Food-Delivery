import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../../shared/api';
import { useSession } from '../../../shared/session';
import { colors, space, type } from '../../../shared/theme';
import { Button, Card, Chip, Field, Notice, Screen } from '../../../shared/ui';

const AREAS = [
  { label: 'Bole', lat: 8.9973, lng: 38.7873 },
  { label: 'Piassa', lat: 9.034, lng: 38.72 },
  { label: 'Kazanchis', lat: 8.994, lng: 38.79 },
  { label: 'Merkato', lat: 9.0033, lng: 38.7561 }
];

export default function Account() {
  const { user, setUser, logout } = useSession();
  const [label, setLabel] = useState('');
  const [line, setLine] = useState('');
  const [area, setArea] = useState(AREAS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addAddress = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.addAddress({
        label: label.trim() || area.label,
        line: line.trim(),
        city: 'Addis Ababa',
        lat: area.lat,
        lng: area.lng
      });
      setUser(data.user);
      setLabel('');
      setLine('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (addressId) => {
    const data = await api.removeAddress(addressId);
    setUser(data.user);
  };

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Card>
          <Text style={type.h1}>{user.name}</Text>
          <Text style={[type.small, { marginTop: 4 }]}>{user.phone}</Text>
          <View style={{ marginTop: space.md }}>
            <Chip label={`${user.role} account`} />
          </View>
        </Card>

        <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>Saved addresses</Text>
        {user.addresses?.length ? (
          user.addresses.map((a) => (
            <Card key={a.id} style={styles.address}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '700' }]}>{a.label}</Text>
                <Text style={type.small}>
                  {a.line}, {a.city} · {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                </Text>
              </View>
              <Text onPress={() => remove(a.id)} style={styles.remove}>
                Remove
              </Text>
            </Card>
          ))
        ) : (
          <Notice text="No address saved yet — add one below to check out." tone="success" />
        )}

        <Card style={{ marginTop: space.xl }}>
          <Text style={type.eyebrow}>Add an address</Text>
          <Notice text={error} />
          <View style={styles.areas}>
            {AREAS.map((a) => (
              <Text key={a.label} onPress={() => setArea(a)} style={[styles.area, area.label === a.label && styles.areaOn]}>
                {a.label}
              </Text>
            ))}
          </View>
          <Field label="Label" value={label} onChangeText={setLabel} placeholder="Home, Work…" />
          <Field label="Street / building" value={line} onChangeText={setLine} placeholder="Rome St, near Gate B" />
          <Text style={type.mono}>{`coords ${area.lat}, ${area.lng}`}</Text>
          <Button label="Save address" onPress={addAddress} loading={busy} style={{ marginTop: space.md }} />
        </Card>

        <Button label="Sign out" variant="ghost" onPress={logout} style={{ marginTop: space.xl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  address: { marginTop: space.sm, flexDirection: 'row', gap: space.md, alignItems: 'center' },
  remove: { color: colors.accentInk, fontWeight: '700', fontSize: 13 },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
  area: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.muted
  },
  areaOn: { borderColor: colors.ink, color: colors.ink, fontWeight: '700', backgroundColor: colors.tint }
});
