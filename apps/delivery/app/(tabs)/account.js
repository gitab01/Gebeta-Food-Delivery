import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { Icon } from '../../../shared/brand';
import { useI18n } from '../../../shared/lang';
import { useSession } from '../../../shared/session';
import { colors, radius, space, type, useStyles } from '../../../shared/theme';
import { Button, Card, Chip, Field, Loading, Notice, Row, Screen, Setting, StatusChip } from '../../../shared/ui';
import { sendDevicePosition, sendPositionOnce } from '../../lib/location';

const age = (iso, t) => {
  if (!iso) return t('profile.never');
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('profile.secondsAgo', { seconds });
  return t('profile.minutesAgo', { minutes: Math.round(seconds / 60) });
};

export default function Account() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { user, logout } = useSession();
  const [courier, setCourier] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState({ lat: '', lng: '' });

  const load = useCallback(async () => {
    try {
      const [me, nearby] = await Promise.all([api.courierMe(), api.restaurants(9.0089, 38.7578)]);
      setCourier(me.courier);
      setJobs(me.jobs);
      setKitchens(nearby.restaurants);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const socket = realtime();
    const onPresence = (payload) => {
      if (payload.id === courier?.id) setCourier((c) => (c ? { ...c, isOnline: payload.isOnline, activeOrders: payload.activeOrders } : c));
    };
    socket.on('courier:presence', onPresence);
    return () => socket.off('courier:presence', onPresence);
  }, [load, courier?.id]);

  const useDevicePosition = async () => {
    setSent('');
    setError('');
    try {
      await sendDevicePosition();
      setSent(t('profile.positionSent'));
      load();
    } catch {
      setError(t('profile.noDevicePosition'));
    }
  };

  const useKitchenPosition = (kitchen) => {
    setSent('');
    sendPositionOnce({ lat: kitchen.lat, lng: kitchen.lng });
    setSent(t('profile.atKitchen', { name: kitchen.name }));
    load();
  };

  const sendManual = () => {
    const lat = Number(manual.lat);
    const lng = Number(manual.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError(t('profile.needBoth'));
      return;
    }
    setSent('');
    sendPositionOnce({ lat, lng });
    setSent(t('profile.positionSent'));
    load();
  };

  if (loading) return <Loading label={t('profile.opening')} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Notice text={error} />
        <Notice tone="success" text={sent} />

        <Card style={styles.profile}>
          <View style={styles.avatar}>
            <Icon name="jobs" size={22} color={colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{courier?.name || user?.name}</Text>
            <Text style={[type.small, { marginTop: 2 }]}>{user?.phone}</Text>
          </View>
          <Chip label={courier?.vehicle || t('vehicle.motorbike')} tone={courier?.isOnline ? 'green' : 'neutral'} icon="motorbike" />
        </Card>

        <Card style={[styles.block, styles.menu]}>
          <Setting icon="motorbike" label={t('vehicle.title')} onPress={() => router.push('/vehicle')} />
          <Setting icon="settings" label={t('set.title')} onPress={() => router.push('/settings')} />
        </Card>

        <Card style={styles.block}>
          <Row
            label={t('profile.status')}
            value={<StatusChip status={courier?.isOnline ? 'COMPLETED' : 'CANCELLED'} label={courier?.isOnline ? t('job.online') : t('job.offline')} />}
          />
          <Row label={t('profile.activeJobs')} value={String(courier?.activeOrders ?? jobs.length)} />
          <Row label={t('profile.delivered')} value={String(courier?.completedDeliveries || 0)} />
          <Row label={t('profile.lastPosition')} value={age(courier?.locationUpdatedAt, t)} />
        </Card>

        <Card style={styles.block}>
          <Text style={type.eyebrow}>{t('profile.position')}</Text>
          <Text style={[type.small, { marginTop: space.sm }]}>{t('profile.positionFoot')}</Text>

          <Button label={t('profile.sendDevice')} variant="ghost" icon="pin-location" onPress={useDevicePosition} style={{ marginTop: space.md }} />

          <Text style={[type.eyebrow, { marginTop: space.lg, marginBottom: space.sm }]}>{t('profile.orSayWhere')}</Text>
          {kitchens.slice(0, 4).map((k) => (
            <View key={k.id} style={styles.kitchen}>
              <View style={{ flex: 1 }}>
                <Text style={type.body} numberOfLines={1}>
                  {k.name}
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  {k.address}
                </Text>
              </View>
              <Button narrow variant="quiet" label={t('profile.imHere')} onPress={() => useKitchenPosition(k)} />
            </View>
          ))}

          <View style={styles.manual}>
            <Field label="Lat" value={manual.lat} onChangeText={(v) => setManual({ ...manual, lat: v })} keyboardType="numeric" style={{ flex: 1 }} />
            <Field label="Lng" value={manual.lng} onChangeText={(v) => setManual({ ...manual, lng: v })} keyboardType="numeric" style={{ flex: 1 }} />
          </View>
          <Button label={t('profile.sendCoords')} variant="ghost" onPress={sendManual} />
        </Card>

        {jobs.length ? (
          <>
            <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>{t('job.yours', { count: jobs.length })}</Text>
            {jobs.map((job) => (
              <Card key={job.id} style={styles.jobRow} onPress={() => router.push(`/job/${job.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{job.restaurantName}</Text>
                  <Text style={type.small}>
                    {t(`st.${job.status}`)} · {km(job.job?.distanceMeters)}
                  </Text>
                </View>
                <Text style={styles.fee}>{etb(job.job?.courierFeeCents)}</Text>
              </Card>
            ))}
          </>
        ) : null}

        <Button
          label={t('auth.signOut')}
          icon="logout"
          variant="danger"
          onPress={() => {
            logout();
            router.replace('/login');
          }}
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
      borderRadius: radius.md,
      backgroundColor: colors.tint,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center'
    },
    block: { marginTop: space.md },
    menu: { paddingVertical: space.xs },
    kitchen: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
    manual: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
    jobRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
    fee: { fontSize: 17, fontWeight: '800' }
  });
