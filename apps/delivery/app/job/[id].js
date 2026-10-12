import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { LiveMap } from '../../../shared/map/LiveMap';
import { Icon } from '../../../shared/brand';
import { useI18n } from '../../../shared/lang';
import { colors, radius, space, type, useStyles } from '../../../shared/theme';
import { useViewport } from '../../../shared/responsive';
import { Button, Card, Chip, Empty, Loading, Notice, Row, Screen, StatusChip } from '../../../shared/ui';
import { sendDevicePosition, useReportedPosition } from '../../lib/location';

export default function JobDetail() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { size } = useViewport();
  const { id } = useLocalSearchParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(true);
  const reported = useReportedPosition();

  /** The two confirmations a courier can make, each guarded by a proximity check on the server. */
  const STEP = {
    ASSIGNED: { action: 'courierPickup', label: t('job.collect'), hint: t('job.hintPickup') },
    READY: { action: 'courierPickup', label: t('job.collectReady'), hint: t('job.hintReady') },
    PREPARING: { hint: t('job.hintWaiting') },
    PICKED_UP: { action: 'courierDeliver', label: t('job.deliver'), hint: t('job.hintDeliver') },
    DELIVERED: { hint: t('job.hintHanded') }
  };

  const load = useCallback(async () => {
    try {
      const [active, history] = await Promise.all([api.courierJobs('active'), api.courierJobs('history')]);
      const found = [...active.jobs, ...history.jobs].find((j) => j.id === id);
      setJob(found || null);
      setError(found ? '' : t('job.notYours'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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
    const join = () => socket.emit('order:join', { orderId: id });
    const onLocation = (payload) => {
      if (payload?.lat == null) return;
      setJob((current) => {
        if (!current || current.id !== id) return current;
        const trail = [...(current.courierTrail || []), { lat: payload.lat, lng: payload.lng, at: payload.at }];
        return { ...current, courierLocation: { lat: payload.lat, lng: payload.lng, at: payload.at }, courierTrail: trail.slice(-150) };
      });
    };
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('courier:job', onJob);
    socket.on('courier:job:closed', onClosed);
    socket.on('courier:location', onLocation);
    return () => {
      socket.off('connect', join);
      socket.off('courier:job', onJob);
      socket.off('courier:job:closed', onClosed);
      socket.off('courier:location', onLocation);
      socket.emit('order:leave', { orderId: id });
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
      setDone(step.action === 'courierDeliver' ? t('job.delivered') : t('job.collected'));
    } catch (err) {
      if (err.code === 'NOT_AT_LOCATION') setError(`${err.message} ${t('job.notAtStop')}`);
      else if (err.code === 'LOCATION_REQUIRED') setError(t('job.needPosition'));
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label={t('job.opening')} />;
  if (!job) {
    return (
      <Screen>
        <Notice text={error} />
        <Empty title={t('job.notOnBoard')} body={t('job.notOnBoardBody')} icon="jobs" />
      </Screen>
    );
  }

  const step = STEP[job.status] || {};
  const detail = job.job || {};
  const stop = (letter, tone, glyph, label, lines, phone, phoneLabel) => (
    <View style={styles.stop}>
      <View style={[styles.pin, { backgroundColor: tone }]}>
        <Text style={[styles.pinGlyph, { color: glyph }]}>{letter}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.eyebrow}>{label}</Text>
        {lines.filter(Boolean).map((line, index) => (
          <Text key={line} style={index === 0 ? type.body : type.small}>
            {line}
          </Text>
        ))}
        {phone ? (
          <Button
            narrow
            variant="quiet"
            icon="phone"
            label={phoneLabel}
            onPress={() => Linking.openURL(`tel:${phone}`)}
            style={{ marginTop: space.sm }}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={type.eyebrow}>#{String(job.id).slice(-6)}</Text>
            <Text style={type.h1}>{job.restaurantName}</Text>
          </View>
          <StatusChip status={job.status} label={t(`st.${job.status}`)} />
        </View>

        <Notice text={error} />
        <Notice tone="success" text={done} />

        <Card style={{ marginTop: space.md }}>
          <LiveMap
            pickup={detail.pickup?.lat != null ? { lat: detail.pickup.lat, lng: detail.pickup.lng, label: detail.pickup.name } : null}
            dropoff={detail.dropoff?.lat != null ? { lat: detail.dropoff.lat, lng: detail.dropoff.lng, label: t('track.dropoff') } : null}
            courier={(() => {
              if (reported.lat != null) return { lat: reported.lat, lng: reported.lng, at: reported.at, label: job.courier?.name };
              const trail = job.courierTrail || [];
              const last = trail[trail.length - 1];
              return last?.lat != null ? { ...last, label: job.courier?.name } : null;
            })()}
            trail={job.courierTrail || []}
            status={job.status}
            height={size === 'phone' ? 210 : 280}
          />
          <Text style={[type.small, { marginTop: space.md }]}>{t('job.map')}</Text>
        </Card>

        <Card style={{ marginTop: space.md }}>
          {stop(
            'K',
            colors.ink,
            colors.paper,
            `${t('job.pickupAt')} · ${detail.pickup?.name || ''}`,
            [detail.pickup?.address],
            detail.pickup?.phone,
            t('job.callKitchen')
          )}
          <View style={styles.rule} />
          {stop(
            'D',
            colors.green,
            colors.paper,
            `${t('job.dropAt')} · ${detail.customerName || t('job.customer')}`,
            detail.addressVisible ? [detail.dropoff?.line, detail.dropoff?.city] : [t('job.addressHidden')],
            detail.addressVisible ? detail.dropoff?.contactPhone : null,
            t('job.callCustomer')
          )}
        </Card>

        {job.notes ? (
          <Card style={{ marginTop: space.md }}>
            <Text style={type.eyebrow}>{t('job.customerNote')}</Text>
            <Text style={[type.body, { marginTop: 4 }]}>{job.notes}</Text>
          </Card>
        ) : null}

        <Card style={{ marginTop: space.md }}>
          <Row label={t('job.total')} value={etb(job.totalCents)} />
          <Row label={t('job.yourFare')} value={etb(detail.courierFeeCents)} />
          <Row label={t('job.distance')} value={km(detail.distanceMeters) || '—'} />
          <Row label={t('job.arriveBy')} value={job.eta?.minutes != null ? t('common.minutes', { n: job.eta.minutes }) : '—'} />
        </Card>

        {job.eta?.reason ? <Text style={[type.small, { marginTop: space.sm }]}>{job.eta.reason}</Text> : null}

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {step.action ? <Button label={step.label} onPress={confirm} loading={busy} disabled={busy} icon="check" /> : null}
          {step.hint ? <Text style={type.small}>{step.hint}</Text> : null}

          {['ASSIGNED', 'PICKED_UP', 'READY'].includes(job.status) ? (
            <Button
              label={t('job.sendPosition')}
              variant="ghost"
              icon="pin-location"
              onPress={async () => {
                setError('');
                setDone('');
                try {
                  await sendDevicePosition();
                  setDone(t('job.positionSent'));
                } catch {
                  setError(t('job.positionFailed'));
                }
              }}
            />
          ) : null}
          {reported.lat != null ? (
            <Chip tone="green" icon="navigate" label={`${reported.lat.toFixed(4)}, ${reported.lng.toFixed(4)}`} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    stop: { flexDirection: 'row', gap: space.md },
    pin: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2
    },
    pinGlyph: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    rule: { height: 1, backgroundColor: colors.line, marginVertical: space.md, marginLeft: 12 }
  });
