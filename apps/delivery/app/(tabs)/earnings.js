import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, etb, realtime } from '../../../shared/api';
import { LABEL } from '../../../shared/status';
import { colors, space, type } from '../../../shared/theme';
import { Card, Empty, Loading, Notice, Row, Screen } from '../../../shared/ui';

const clock = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function Earnings() {
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

  if (loading) return <Loading label="Counting your fares" />;

  return (
    <Screen style={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Notice text={error} />

        <Text style={type.eyebrow}>Today</Text>
        <Text style={styles.big}>{data ? etb(data.todayCents) : etb(0)}</Text>

        <Card style={{ marginTop: space.lg }}>
          <Row label="This week" value={etb(data?.weekCents || 0)} />
          <Row label="Lifetime" value={etb(data?.lifetimeCents || 0)} />
          <Row label="Deliveries" value={String(data?.completedDeliveries || 0)} />
          <Row
            label="Rating"
            value={data?.ratingCount ? `${data.ratingStars.toFixed(1)} ★ from ${data.ratingCount}` : 'no ratings yet'}
          />
        </Card>

        <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>Settled fares</Text>
        {!data?.rows?.length ? (
          <Empty title="No completed jobs yet" body="A fare appears here once you confirm delivery at the door." />
        ) : (
          data.rows.map((row) => (
            <View key={row.orderId} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>#{row.orderId.slice(-6)}</Text>
                <Text style={type.small}>
                  {clock(row.deliveredAt)} · {LABEL[row.status]} · order {etb(row.orderTotalCents)}
                </Text>
              </View>
              <Text style={styles.fee}>{etb(row.feeCents)}</Text>
            </View>
          ))
        )}

        <Text style={[type.small, { marginTop: space.xl, color: colors.faint }]}>
          The fare is fixed when the order is placed, so a longer trip does not change what you are paid for this one.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, marginTop: 4 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  fee: { fontSize: 17, fontWeight: '800' }
});
