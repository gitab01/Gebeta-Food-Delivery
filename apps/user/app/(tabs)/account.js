import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../../shared/api';
import { Icon } from '../../../shared/brand';
import { useI18n } from '../../../shared/lang';
import { useSession } from '../../../shared/session';
import { colors, radius, space, type, useStyles } from '../../../shared/theme';
import { Button, Card, Chip, Field, Notice, Screen, Setting } from '../../../shared/ui';

const AREAS = [
  { label: 'Bole', lat: 8.9973, lng: 38.7873 },
  { label: 'Piassa', lat: 9.034, lng: 38.72 },
  { label: 'Kazanchis', lat: 8.994, lng: 38.79 },
  { label: 'Merkato', lat: 9.0033, lng: 38.7561 }
];

export default function Account() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { user, setUser, logout } = useSession();
  const [adding, setAdding] = useState(false);
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
      setAdding(false);
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
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{(user?.name || '?').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{user?.name}</Text>
            <Text style={[type.small, { marginTop: 2 }]}>{user?.phone}</Text>
          </View>
          <Chip label={t('account.role', { role: user?.role })} icon="person" />
        </Card>

        <Card style={[styles.block, styles.menu]}>
          <Setting
            icon="card"
            label={t('pay.title')}
            value={user?.paymentMethods?.length ? t('common.count', { count: user.paymentMethods.length }) : t('pay.empty')}
            onPress={() => router.push('/payment')}
          />
          <Setting icon="settings" label={t('set.title')} onPress={() => router.push('/settings')} />
          <Setting
            icon="pin"
            label={t('account.savedAddresses')}
            value={user?.addresses?.length ? t('common.count', { count: user.addresses.length }) : t('account.noAddress')}
            onPress={() => setAdding((open) => !open)}
          />
        </Card>

        <Notice text={error} />

        {user?.addresses?.length ? (
          user.addresses.map((a) => (
            <Card key={a.id} style={styles.address}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{a.label}</Text>
                <Text style={type.small}>
                  {a.line}, {a.city} · {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => remove(a.id)} accessibilityRole="button" accessibilityLabel={t('account.remove')}>
                <Icon name="trash" size={18} color={colors.faint} />
              </Pressable>
            </Card>
          ))
        ) : null}

        {adding ? (
          <Card style={styles.block}>
            <Text style={type.eyebrow}>{t('account.addAddress')}</Text>
            <View style={styles.areas}>
              {AREAS.map((a) => (
                <Pressable key={a.label} onPress={() => setArea(a)} accessibilityRole="button" style={[styles.area, area.label === a.label && styles.areaOn]}>
                  <Text style={[styles.areaText, area.label === a.label && styles.areaTextOn]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <Field label={t('account.addressLabel')} value={label} onChangeText={setLabel} placeholder={t('account.addressLabelHint')} />
            <Field label={t('account.street')} value={line} onChangeText={setLine} placeholder={t('account.streetHint')} />
            <Text style={type.mono}>{`${area.lat}, ${area.lng}`}</Text>
            <Button label={t('account.saveAddress')} icon="check" onPress={addAddress} loading={busy} style={{ marginTop: space.md }} />
          </Card>
        ) : null}

        <Button
          label={t('auth.signOut')}
          icon="logout"
          variant="ghost"
          onPress={logout}
          style={{ marginTop: space.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.tint,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center'
    },
    initial: { fontSize: 19, fontWeight: '800', color: colors.ink },
    block: { marginTop: space.md },
    menu: { paddingVertical: space.xs },
    address: { marginTop: space.sm, flexDirection: 'row', gap: space.md, alignItems: 'center' },
    areas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
    area: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    areaOn: { borderColor: colors.ink, backgroundColor: colors.tint },
    areaText: { fontSize: 13, color: colors.muted },
    areaTextOn: { color: colors.ink, fontWeight: '700' }
  });
