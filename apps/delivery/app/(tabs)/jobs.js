import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { useI18n } from '../../../shared/lang';
import { colors, space, type, useStyles } from '../../../shared/theme';
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
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const seconds = useCountdown(offer.expiresAt);
  const urgent = seconds <= 10;

  return (
    <Card style={styles.offer}>
      <View style={styles.offerHead}>
        <Text style={type.eyebrow}>{t('offer.incoming')}</Text>
        <Chip label={seconds > 0 ? t('offer.seconds', { seconds }) : t('offer.expired')} tone={urgent ? 'accent' : 'amber'} />
      </View>

      <Text style={type.h2}>{offer.restaurantName}</Text>
      <Text style={[type.small, { marginTop: 4 }]}>
        {km(offer.distanceToRestaurantMeters)} · {t('offer.orderTotal', { total: etb(offer.orderTotalCents) })}
      </Text>
      <Text style={[styles.fee, { color: urgent ? colors.accent : colors.ink }]}>{etb(offer.courierFeeCents)}</Text>

      <View style={styles.stop}>
        <View style={[styles.pin, { backgroundColor: colors.ink }]}>
          <Text style={[styles.pinGlyph, { color: colors.paper }]}>K</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.eyebrow}>{t('job.pickupAt')}</Text>
          <Text style={type.body}>{offer.pickup?.address}</Text>
        </View>
      </View>
      <View style={styles.stop}>
        <View style={[styles.pin, { backgroundColor: colors.green }]}>
          <Text style={styles.pinGlyph}>D</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.eyebrow}>
            {t('job.dropAt')} · {offer.customerName || t('job.customer')}
          </Text>
          <Text style={type.body}>{offer.dropoff?.line}</Text>
          <Text style={type.small}>
            {offer.dropoff?.city} · {offer.dropoff?.contactPhone}
          </Text>
        </View>
      </View>

      <View style={styles.offerActions}>
        <Button label={t('job.accept')} icon="check" onPress={() => onRespond(offer, 'accept')} style={{ flex: 1 }} />
        <Button label={t('job.decline')} variant="ghost" onPress={() => onRespond(offer, 'decline')} style={{ flex: 1 }} />
      </View>
      <Text style={[type.small, { marginTop: space.sm }]}>{t('offer.foot')}</Text>
    </Card>
  );
}

export default function Jobs() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
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
      setError(err.code === 'NO_COURIER_PROFILE' ? t('job.noProfile') : err.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setJobs((current) => [payload, ...current.filter((j) => j.id !== payload.id)]);
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
        setError(result?.error === 'OFFER_NO_LONGER_LIVE' ? t('offer.gone') : result?.error || t('offer.failed'));
      }
      setOffer(null);
      refresh();
    });
  };

  const activeJobs = useMemo(() => jobs.filter((j) => !['DELIVERED', 'COMPLETED'].includes(j.status)), [jobs]);

  if (loading) return <Loading label={t('job.openingShift')} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.shift}>
          <View style={{ flex: 1 }}>
            <View style={styles.connected}>
              <View style={[styles.pulse, { backgroundColor: connected ? colors.green : colors.amber }]} />
              <Text style={type.eyebrow}>{connected ? t('job.connected') : t('job.reconnecting')}</Text>
            </View>
            <Text style={[type.h1, { marginTop: 4, fontSize: 24 }]}>{courier?.name || t('job.courier')}</Text>
            <Text style={type.small}>
              {t(`vehicle.${courier?.vehicle || 'motorbike'}`)} · {courier?.completedDeliveries || 0} {t('job.deliveredCount')}
              {courier?.ratingCount ? ` · ${courier.ratingStars.toFixed(1)}★` : ` · ${t('home.notRated')}`}
            </Text>
          </View>
          <View style={styles.switchBox}>
            <Text style={type.eyebrow}>{courier?.isOnline ? t('job.online') : t('job.offline')}</Text>
            <Switch
              value={Boolean(courier?.isOnline)}
              onValueChange={setOnline}
              disabled={busySwitch}
              trackColor={{ false: colors.line, true: colors.greenTint }}
              thumbColor={courier?.isOnline ? colors.green : colors.faint}
            />
            <Text style={[type.small, { marginTop: 2 }]}>{courier?.isOnline ? t('job.receiving') : t('job.paused')}</Text>
          </View>
        </View>

        <Notice text={error} />

        {!courier?.isOnline ? <Notice tone="success" icon="bell" text={t('job.goOnlineHint')} /> : null}

        {offer ? <OfferCard offer={offer} onRespond={respond} /> : null}

        <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>{t('job.yours', { count: activeJobs.length })}</Text>

        {!activeJobs.length ? (
          <Empty
            icon="jobs"
            title={courier?.isOnline ? t('job.waiting') : t('job.emptyBoard')}
            body={t('job.waitingBody')}
          />
        ) : (
          <View style={styles.jobList}>
            {activeJobs.map((job) => (
              <Card key={job.id} onPress={() => router.push(`/job/${job.id}`)}>
                <View style={styles.jobHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2} numberOfLines={1}>
                      {job.restaurantName}
                    </Text>
                    <Text style={type.small}>
                      {t('job.lines', { count: job.items?.length || 0 })} · {km(job.job?.distanceMeters)}
                    </Text>
                  </View>
                  <StatusChip status={job.status} label={t(`st.${job.status}`)} />
                </View>
                <View style={styles.jobFoot}>
                  <Text style={styles.feeSmall}>{etb(job.job?.courierFeeCents)}</Text>
                  <Link href={`/job/${job.id}`} style={styles.open}>
                    {t('job.open')}
                  </Link>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={{ marginTop: space.xl }}>
          <Button label={t('job.toEarnings')} variant="ghost" icon="chart" onPress={() => router.push('/(tabs)/earnings')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    shift: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
    connected: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pulse: { width: 7, height: 7, borderRadius: 4 },
    switchBox: { alignItems: 'flex-end' },
    offer: { borderWidth: 2, borderColor: colors.ink, marginBottom: space.lg },
    offerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
    fee: { fontSize: 30, fontWeight: '800', letterSpacing: -1, marginTop: space.md },
    stop: { flexDirection: 'row', gap: space.md, marginTop: space.md },
    pin: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1
    },
    pinGlyph: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    offerActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
    jobList: { gap: space.md },
    jobHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
    jobFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md },
    feeSmall: { fontSize: 18, fontWeight: '800' },
    open: { color: colors.accentInk, fontWeight: '700', fontSize: 14 }
  });
