import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { LABEL } from '../../../shared/status';
import { colors, space, type } from '../../../shared/theme';
import { Button, Card, Empty, Loading, Notice, Row, Screen, StatusChip } from '../../../shared/ui';
import { sendDevicePosition } from '../../lib/location';

/** The two confirmations a courier can make, each guarded by a proximity check on the server. */
const STEP = {
  ASSIGNED: { action: 'courierPickup', label: 'I have collected the food', need: 'Confirm only at the restaurant door — your last position is checked against it.' },
  READY: { action: 'courierPickup', label: 'Collect the ready order', need: 'The kitchen says it is ready. Confirm once you are at the counter.' },
  PREPARING: { need: 'The kitchen is still cooking. Wait at the counter, or watch the ETA update as it moves.' },
  PICKED_UP: { action: 'courierDeliver', label: 'Delivered to the customer', need: 'Confirm at the door — your last position is checked against the drop-off.' },
  DELIVERED: { need: 'Handed over. The customer rates the trip and the fare settles.' }
};

export default function JobDetail() {
  const { id } = useLocalSearchParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [active, history] = await Promise.all([api.courierJobs('active'), api.courierJobs('history')]);
      const found = [...active.jobs, ...history.jobs].find((j) => j.id === id);
      setJob(found || null);
      if (!found) setError('This job is no longer yours.');
      else setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = realtime();
    const onJob = (payload) => {
      if (payload.id === id) setJob(payload);
    };
    const onClosed = (payload) => {
      if (payload.orderId === id) load();
    };
    socket.on('courier:job', onJob);
    socket.on('courier:job:closed', onClosed);
    return () => {
      socket.off('courier:job', onJob);
      socket.off('courier:job:closed', onClosed);
    };
  }, [id, load]);

  const confirm = async () => {
    const step = STEP[job.status];
    if (!step?.action) return;
    setBusy(true);
    setError('');
    try {
      const data = await api[step.action](job.id);
      setJob(data.order);
      setDone(step.action === 'courierDeliver' ? 'Delivered. The customer can now rate the trip.' : 'Collected. Head to the drop-off.');
    } catch (err) {
      if (err.code === 'NOT_AT_LOCATION') {
        setError(`${err.message} Send your position again if your phone has moved since.`);
      } else if (err.code === 'LOCATION_REQUIRED') {
        setError('Your position has not reached the server yet. Use “Send my position” below.');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label="Opening the job" />;
  if (!job) {
    return (
      <Screen>
        <Notice text={error} />
        <Empty title="Job not on your board" body="It was handed back, cancelled, or completed by another courier." />
      </Screen>
    );
  }

  const step = STEP[job.status] || {};
  const job_ = job.job || {};

  return (
    <Screen style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={type.eyebrow}>#{String(job.id).slice(-6)}</Text>
            <Text style={type.h1}>{job.restaurantName}</Text>
          </View>
          <StatusChip status={job.status} label={LABEL[job.status]} />
        </View>

        <Notice text={error} />
        <Notice tone="success" text={done} />

        <Card style={{ marginTop: space.lg }}>
          <View style={styles.stop}>
            <Text style={[styles.pin, { color: colors.accent }]}>P</Text>
            <View style={{ flex: 1 }}>
              <Text style={type.eyebrow}>Pick up</Text>
              <Text style={type.body}>{job_.pickup?.name}</Text>
              <Text style={type.small}>{job_.pickup?.address}</Text>
              {job_.pickup?.phone ? (
                <Text style={styles.phone} onPress={() => Linking.openURL(`tel:${job_.pickup.phone}`)}>
                  call the kitchen · {job_.pickup.phone}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.rule, {}]} />

          <View style={styles.stop}>
            <Text style={[styles.pin, { color: colors.green }]}>D</Text>
            <View style={{ flex: 1 }}>
              <Text style={type.eyebrow}>Drop off · {job_.customerName || 'customer'}</Text>
              {job_.addressVisible ? (
                <>
                  <Text style={type.body}>{job_.dropoff?.line}</Text>
                  <Text style={type.small}>{job_.dropoff?.city}</Text>
                  {job_.dropoff?.contactPhone ? (
                    <Text style={styles.phone} onPress={() => Linking.openURL(`tel:${job_.dropoff.contactPhone}`)}>
                      call the customer · {job_.dropoff.contactPhone}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={type.small}>The address appears once you have collected the food.</Text>
              )}
            </View>
          </View>
        </Card>

        {job.notes ? (
          <Card style={{ marginTop: space.md }}>
            <Text style={type.eyebrow}>Customer note</Text>
            <Text style={[type.body, { marginTop: 4 }]}>{job.notes}</Text>
          </Card>
        ) : null}

        <Card style={{ marginTop: space.md }}>
          <Row label="Order total" value={etb(job.totalCents)} />
          <Row label="Your fare" value={etb(job_.courierFeeCents)} />
          <Row label="Trip distance" value={km(job_.distanceMeters) || '—'} />
          <Row
            label="Arrive by"
            value={job.eta?.minutes != null ? `${job.eta.minutes} min` : '—'}
          />
        </Card>

        {job.eta?.reason ? (
          <Text style={[type.small, { marginTop: space.sm, color: colors.muted }]}>{job.eta.reason}</Text>
        ) : null}

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {step.action ? (
            <Button label={step.label} onPress={confirm} loading={busy} disabled={busy} />
          ) : null}
          {step.need ? <Text style={[type.small, { color: colors.faint }]}>{step.need}</Text> : null}

          {['ASSIGNED', 'PICKED_UP', 'READY'].includes(job.status) ? (
            <Button
              label="Send my position now"
              variant="ghost"
              onPress={async () => {
                setError('');
                setDone('');
                try {
                  await sendDevicePosition();
                  setDone('Position sent — confirm the stop again.');
                } catch (err) {
                  setError('This device would not give up a position. Set it from the Profile tab instead.');
                }
              }}
              style={{ marginTop: space.sm }}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  stop: { flexDirection: 'row', gap: space.md },
  pin: { fontSize: 17, fontWeight: '800', width: 18 },
  rule: { width: 1, backgroundColor: colors.line, marginLeft: 8, minHeight: 26 },
  phone: { color: colors.accentInk, fontWeight: '700', fontSize: 14, marginTop: 4 }
});
