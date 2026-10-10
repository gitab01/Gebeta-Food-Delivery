import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { LABEL } from '../../../shared/status';
import { colors, space, type } from '../../../shared/theme';
import { Button, Card, Chip, Empty, Loading, Notice, Screen, StatusChip } from '../../../shared/ui';

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!expiresAt) return undefined;
    const end = new Date(expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return remaining;
}

function OfferCard({ offer, onRespond }) {
  const seconds = useCountdown(offer.expiresAt);
  const urgent = seconds <= 10;
  return (
    <Card style={styles.offer}>
      <View style={styles.offerHead}>
        <Text style={type.eyebrow}>Incoming job offer</Text>
        <Chip label={seconds > 0 ? `${seconds}s to decide` : 'expired'} tone={urgent ? 'accent' : 'amber'} />
      </View>

      <Text style={type.h2}>{offer.restaurantName}</Text>
      <Text style={[type.small, { marginTop: 4 }]}>
        {km(offer.distanceToRestaurantMeters)} to the pickup · order {etb(offer.orderTotalCents)}
      </Text>
      <Text style={[styles.fee, { color: urgent ? colors.accent : colors.ink }]}>{etb(offer.courierFeeCents)}</Text>

      <View style={styles.stop}>
        <Text style={styles.pin}>P</Text>
        <View style={{ flex: 1 }}>
          <Text style={type.eyebrow}>Pick up</Text>
          <Text style={type.body}>{offer.pickup?.address}</Text>
        </View>
      </View>
      <View style={styles.stop}>
        <Text style={[styles.pin, { color: colors.green }]}>D</Text>
        <View style={{ flex: 1 }}>
          <Text style={type.eyebrow}>Drop off · {offer.customerName || 'customer'}</Text>
          <Text style={type.body}>{offer.dropoff?.line}</Text>
          <Text style={type.small}>{offer.dropoff?.city} · {offer.dropoff?.contactPhone}</Text>
        </View>
      </View>

      <View style={styles.offerActions}>
        <Button label="Accept" onPress={() => onRespond(offer, 'accept')} style={{ flex: 1 }} />
        <Button label="Decline" variant="ghost" onPress={() => onRespond(offer, 'decline')} style={{ flex: 1 }} />
      </View>
      <Text style={[type.small, { marginTop: space.sm, color: colors.faint }]}>
        If nobody takes it, it goes to the next courier and you are told it is gone.
      </Text>
    </Card>
  );
}

export default function Jobs() {
  const [courier, setCourier] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busySwitch, setBusySwitch] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.courierMe();
      setCourier(data.courier);
      setJobs(data.jobs);
      setError('');
    } catch (err) {
      setError(err.code === 'NO_COURIER_PROFILE' ? 'This account has no courier profile.' : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * The pool feed is not a polling problem: the server pushes the offer to this
   * courier's room, closes it when someone else takes it, and re-sends the whole
   * job snapshot on `courier:job`, so a reconnect never shows a stale ticket.
   */
  useEffect(() => {
    const socket = realtime();
    const onConnect = () => {
      setConnected(true);
      refresh();
    };
    const onDisconnect = () => setConnected(false);
    const onOffer = (payload) => setOffer(payload);
    const onOfferClosed = (payload) => {
      setOffer((current) => (current && current.orderId === payload.orderId ? null : current));
    };
    const onJob = (payload) => {
      setJobs((current) => {
        const next = current.filter((j) => j.id !== payload.id);
        return [payload, ...next];
      });
    };
    const onJobClosed = (payload) => {
      setJobs((current) => current.filter((j) => j.id !== payload.orderId));
      setOffer((current) => (current && current.orderId === payload.orderId ? null : current));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('courier:offer', onOffer);
    socket.on('courier:offer:closed', onOfferClosed);
    socket.on('courier:job', onJob);
    socket.on('courier:job:closed', onJobClosed);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('courier:offer', onOffer);
      socket.off('courier:offer:closed', onOfferClosed);
      socket.off('courier:job', onJob);
      socket.off('courier:job:closed', onJobClosed);
    };
  }, [refresh]);

  const setOnline = async (isOnline) => {
    setBusySwitch(true);
    setError('');
    try {
      const data = await api.courierOnline(isOnline);
      setCourier(data.courier);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySwitch(false);
    }
  };

  const respond = (payload, decision) => {
    const socket = realtime();
    socket.emit('courier:offer:respond', { orderId: payload.orderId, decision }, (result) => {
      if (!result?.ok) {
        setError(result?.error === 'OFFER_NO_LONGER_LIVE' ? 'That offer went to another courier.' : result?.error || 'Could not send your answer.');
      }
      setOffer(null);
      refresh();
    });
  };

  const activeJobs = useMemo(() => jobs.filter((j) => !['DELIVERED', 'COMPLETED'].includes(j.status)), [jobs]);

  if (loading) return <Loading label="Opening your shift" />;

  return (
    <Screen style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <View style={styles.shift}>
          <View style={{ flex: 1 }}>
            <Text style={type.eyebrow}>{connected ? 'realtime connected' : 'reconnecting…'}</Text>
            <Text style={[type.h1, { marginTop: 4, fontSize: 24 }]}>{courier?.name || 'Courier'}</Text>
            <Text style={type.small}>
              {courier?.vehicle} · {courier?.completedDeliveries || 0} delivered ·{' '}
              {courier?.ratingCount ? `${courier.ratingStars.toFixed(1)}★` : 'not rated yet'}
            </Text>
          </View>
          <View style={styles.switchBox}>
            <Text style={type.eyebrow}>{courier?.isOnline ? 'Online' : 'Offline'}</Text>
            <Switch
              value={Boolean(courier?.isOnline)}
              onValueChange={setOnline}
              disabled={busySwitch}
              trackColor={{ false: colors.line, true: colors.greenTint }}
              thumbColor={courier?.isOnline ? colors.green : colors.faint}
            />
            <Text style={[type.small, { marginTop: 2 }]}>{courier?.isOnline ? 'receiving offers' : 'no offers sent'}</Text>
          </View>
        </View>

        <Notice text={error} />

        {!courier?.isOnline ? (
          <Notice tone="success" text="Go online to start receiving offers. Your position is already being shared, so the first offer can arrive the moment you switch." />
        ) : null}

        {offer ? <OfferCard offer={offer} onRespond={respond} /> : null}

        <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>
          Your jobs ({activeJobs.length})
        </Text>

        {!activeJobs.length ? (
          <Empty
            title={courier?.isOnline ? 'Waiting for the next offer' : 'Nothing on the board'}
            body="Offers are sent to the nearest online courier with room left, so staying online and near a busy kitchen is what fills this list."
          />
        ) : (
          activeJobs.map((job) => (
            <Card key={job.id} style={styles.job} onPress={() => router.push(`/job/${job.id}`)}>
              <View style={styles.jobHead}>
                <View style={{ flex: 1 }}>
                  <Text style={type.h2}>{job.restaurantName}</Text>
                  <Text style={type.small}>
                    {job.items?.length || 0} line(s) · {km(job.job?.distanceMeters)} to drop off
                  </Text>
                </View>
                <StatusChip status={job.status} label={LABEL[job.status]} />
              </View>
              <View style={styles.jobFoot}>
                <Text style={styles.feeSmall}>{etb(job.job?.courierFeeCents)}</Text>
                <Link href={`/job/${job.id}`} style={styles.open}>
                  Open job →
                </Link>
              </View>
            </Card>
          ))
        )}

        <View style={{ marginTop: space.xl }}>
          <Button label="Completed jobs and earnings" variant="ghost" onPress={() => router.push('/(tabs)/earnings')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shift: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  switchBox: { alignItems: 'flex-end' },
  offer: { borderWidth: 2, borderColor: colors.ink, marginBottom: space.lg },
  offerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  fee: { fontSize: 30, fontWeight: '800', letterSpacing: -1, marginTop: space.md },
  stop: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  pin: { fontSize: 16, fontWeight: '800', color: colors.accent, width: 18 },
  offerActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  job: { marginBottom: space.md },
  jobHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  jobFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md },
  feeSmall: { fontSize: 18, fontWeight: '800' },
  open: { color: colors.accentInk, fontWeight: '700' }
});
