import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { useSession } from '../../../shared/session';
import { LABEL } from '../../../shared/status';
import { colors, space, type } from '../../../shared/theme';
import { Button, Card, Chip, Field, Loading, Notice, Row, Screen, StatusChip } from '../../../shared/ui';
import { sendDevicePosition, sendPositionOnce } from '../../lib/location';

const age = (iso) => {
  if (!iso) return null;
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)} min ago`;
};

export default function Account() {
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
      setSent('Your device position was sent to the marketplace.');
      load();
    } catch (err) {
      setError('No position from this device. Use one of the kitchen positions below.');
    }
  };

  const useKitchenPosition = (kitchen) => {
    setSent('');
    sendPositionOnce({ lat: kitchen.lat, lng: kitchen.lng });
    setSent(`Marked you at ${kitchen.name}.`);
    load();
  };

  const sendManual = () => {
    const lat = Number(manual.lat);
    const lng = Number(manual.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Enter both a latitude and a longitude.');
      return;
    }
    setSent('');
    sendPositionOnce({ lat, lng });
    setSent('Position sent.');
    load();
  };

  if (loading) return <Loading label="Loading your profile" />;

  return (
    <Screen style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Notice text={error} />
        <Notice tone="success" text={sent} />

        <Card>
          <Text style={type.h2}>{courier?.name || user?.name}</Text>
          <Text style={[type.small, { marginTop: 2 }]}>{user?.phone}</Text>
          <View style={{ marginTop: space.md }}>
            <Chip label={courier?.vehicle || 'courier'} tone={courier?.isOnline ? 'green' : 'neutral'} />
          </View>
          <Card style={{ marginTop: space.lg, padding: 0, borderWidth: 0 }}>
            <Row label="Status" value={<StatusChip status={courier?.isOnline ? 'COMPLETED' : 'CANCELLED'} label={courier?.isOnline ? 'Online' : 'Offline'} />} />
            <Row label="Active jobs" value={String(courier?.activeOrders ?? jobs.length)} />
            <Row label="Delivered" value={String(courier?.completedDeliveries || 0)} />
            <Row label="Last position" value={age(courier?.locationUpdatedAt) || 'never'} />
          </Card>
        </Card>

        <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>Position</Text>
        <Text style={[type.small, { marginBottom: space.md }]}>
          While you are signed in the app reports you every few seconds and the server keeps the fastest useful trail.
          Confirming a pickup or a delivery is refused unless your last report is within a few hundred metres of the
          door, so these controls exist for the moments the GPS is not the truth — a basement kitchen, a phone on 3%.
        </Text>

        <Button label="Send my device position" variant="ghost" onPress={useDevicePosition} />

        <Text style={[type.eyebrow, { marginTop: space.lg, marginBottom: space.sm }]}>Or say where you are</Text>
        {kitchens.map((k) => (
          <View key={k.id} style={styles.kitchen}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>
                {k.emoji} {k.name}
              </Text>
              <Text style={type.small}>{k.address}</Text>
            </View>
            <Button label="I am here" variant="ghost" onPress={() => useKitchenPosition(k)} style={styles.hereButton} />
          </View>
        ))}

        <View style={styles.manual}>
          <Field label="Latitude" value={manual.lat} onChangeText={(v) => setManual({ ...manual, lat: v })} keyboardType="numeric" style={{ flex: 1 }} />
          <Field label="Longitude" value={manual.lng} onChangeText={(v) => setManual({ ...manual, lng: v })} keyboardType="numeric" style={{ flex: 1 }} />
        </View>
        <Button label="Send exact coordinates" variant="ghost" onPress={sendManual} />

        {jobs.length ? (
          <>
            <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>Open jobs</Text>
            {jobs.map((job) => (
              <Card key={job.id} style={styles.jobRow} onPress={() => router.push(`/job/${job.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{job.restaurantName}</Text>
                  <Text style={type.small}>
                    {LABEL[job.status]} · drop-off {km(job.job?.distanceMeters)}
                  </Text>
                </View>
                <Text style={styles.fee}>{etb(job.job?.courierFeeCents)}</Text>
              </Card>
            ))}
          </>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          <Button
            label="Sign out"
            variant="danger"
            onPress={() => {
              logout();
              router.replace('/login');
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kitchen: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  hereButton: { minWidth: 110 },
  manual: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  fee: { fontSize: 17, fontWeight: '800' }
});
