import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, etb } from '../../../shared/api';
import { LABEL } from '../../../shared/status';
import { colors, space, type } from '../../../shared/theme';
import { Card, Chip, Empty, Loading, Screen, StatusChip } from '../../../shared/ui';

const SCOPES = [
  { key: 'active', label: 'Live' },
  { key: 'done', label: 'Delivered' },
  { key: 'all', label: 'All' }
];

export default function Orders() {
  const router = useRouter();
  const [scope, setScope] = useState('active');
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.myOrders(scope);
      setOrders(data.orders);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Text style={type.h1}>Your orders</Text>
        <View style={styles.scopes}>
          {SCOPES.map((s) => (
            <Text
              key={s.key}
              onPress={() => setScope(s.key)}
              style={[styles.scope, scope === s.key && styles.scopeOn]}
            >
              {s.label}
            </Text>
          ))}
        </View>
        {error ? <Text style={[type.small, { color: colors.accentInk, marginTop: space.sm }]}>{error}</Text> : null}
      </View>

      {busy && !orders.length ? (
        <Loading label="Loading orders" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.muted} />}
          ListEmptyComponent={<Empty title="Nothing here" body="Order from a kitchen and it will appear with live status." />}
          renderItem={({ item }) => (
            <Card style={styles.row} onPress={() => router.push(`/track/${item.id}`)}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.h2]}>{item.restaurantName}</Text>
                  <Text style={type.small}>
                    {item.items.reduce((n, i) => n + i.qty, 0)} items · {etb(item.totalCents)}
                  </Text>
                </View>
                <StatusChip status={item.status} label={LABEL[item.status]} />
              </View>
              {item.eta?.reason ? (
                <View style={styles.eta}>
                  <Chip tone="accent" label={`${item.eta.minutes} min`} />
                  <Text style={[type.small, { flex: 1 }]} numberOfLines={2}>
                    {item.eta.reason}
                  </Text>
                </View>
              ) : null}
              {item.courierName ? <Text style={[type.small, { marginTop: 6 }]}>Courier: {item.courierName}</Text> : null}
              {item.cancelReason || item.rejectReason ? (
                <Text style={[styles.reason, { color: colors.accentInk }]}>
                  {item.cancelReason || item.rejectReason}
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingBottom: space.md },
  scopes: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  scope: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.muted
  },
  scopeOn: { borderColor: colors.ink, color: colors.ink, fontWeight: '700', backgroundColor: colors.tint },
  row: { marginBottom: space.md },
  rowTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  eta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  reason: { marginTop: space.sm, fontSize: 13, fontWeight: '600' }
});
