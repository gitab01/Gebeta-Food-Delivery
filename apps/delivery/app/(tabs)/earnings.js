import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, etb, realtime } from '../../../shared/api';
import { Bars, Metric, Share } from '../../../shared/charts';
import { useI18n } from '../../../shared/lang';
import { colors, space, type, useStyles } from '../../../shared/theme';
import { Card, Empty, Loading, Notice, Row, Screen } from '../../../shared/ui';

const clock = (iso) =>
  iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);

/** Seven buckets ending today, so a quiet day still shows as a gap rather than a lie. */
function lastSeven(rows) {
  const days = [];
  for (let back = 6; back >= 0; back -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - back);
    days.push({ key: date.toISOString().slice(0, 10), value: 0, label: date.toLocaleDateString([], { weekday: 'short' }).slice(0, 2) });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const row of rows) {
    const bucket = byKey.get(dayKey(row.deliveredAt));
    if (bucket) bucket.value += row.feeCents;
  }
  return days;
}

export default function Earnings() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await api.courierEarnings());
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
    // A settled job is the only thing that changes this screen, so one event is enough.
    const onUpdate = () => load();
    socket.on('courier:job', onUpdate);
    socket.on('courier:job:closed', onUpdate);
    return () => {
      socket.off('courier:job', onUpdate);
      socket.off('courier:job:closed', onUpdate);
    };
  }, [load]);

  const days = useMemo(() => lastSeven(data?.rows || []), [data]);
  const bestDay = days.reduce((top, day) => (day.value > (top?.value ?? -1) ? day : top), null);
  const weekEarlier = Math.max(0, (data?.lifetimeCents || 0) - (data?.weekCents || 0));

  if (loading) return <Loading label={t('earn.counting')} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Notice text={error} />

        <Text style={type.eyebrow}>{t('earn.today')}</Text>
        <Text style={styles.big}>{etb(data?.todayCents || 0)}</Text>

        <View style={styles.metrics}>
          <Card style={styles.metricCard}>
            <Metric label={t('earn.week')} value={etb(data?.weekCents || 0)} icon="money" />
          </Card>
          <Card style={styles.metricCard}>
            <Metric label={t('earn.completed')} value={String(data?.completedDeliveries || 0)} icon="check" tone="green" />
          </Card>
        </View>

        <Card style={{ marginTop: space.md }}>
          <Text style={type.eyebrow}>{t('earn.byDay')}</Text>
          <View style={{ marginTop: space.md }}>
            <Bars
              data={days}
              height={120}
              labelFor={(day) => day.label}
              bestLabel={bestDay?.value ? `${t('earn.best')} · ${bestDay.label}` : t('earn.noneShort')}
            />
          </View>
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Text style={type.eyebrow}>{t('earn.byStatus')}</Text>
          <View style={{ marginTop: space.md }}>
            <Share
              total={data?.lifetimeCents || 0}
              slices={[
                { key: 'week', value: data?.weekCents || 0, label: t('earn.week'), color: colors.accent },
                { key: 'before', value: weekEarlier, label: t('earn.before'), color: colors.line }
              ]}
            />
          </View>
          <Row label={t('earn.total')} value={etb(data?.lifetimeCents || 0)} style={{ marginTop: space.md }} />
          <Row
            label={t('earn.perJob')}
            value={data?.completedDeliveries ? etb(Math.round((data.lifetimeCents || 0) / data.completedDeliveries)) : '—'}
          />
          <Row
            label={t('earn.rating')}
            value={data?.ratingCount ? `${data.ratingStars.toFixed(1)} ★ (${data.ratingCount})` : t('home.notRated')}
          />
        </Card>

        <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>{t('earn.settled')}</Text>
        {!data?.rows?.length ? (
          <Empty icon="earnings" title={t('earn.none')} body={t('earn.noneBody')} />
        ) : (
          data.rows.map((row) => (
            <View key={row.orderId} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>#{row.orderId.slice(-6)}</Text>
                <Text style={type.small}>
                  {clock(row.deliveredAt)} · {t(`st.${row.status}`)} · {etb(row.orderTotalCents)}
                </Text>
              </View>
              <Text style={styles.fee}>{etb(row.feeCents)}</Text>
            </View>
          ))
        )}

        <Text style={[type.small, styles.foot]}>{t('earn.fareFoot')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    big: { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, marginTop: 4, color: colors.ink },
    metrics: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
    metricCard: { flex: 1 },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.line
    },
    fee: { fontSize: 17, fontWeight: '800' },
    foot: { marginTop: space.xl }
  });
