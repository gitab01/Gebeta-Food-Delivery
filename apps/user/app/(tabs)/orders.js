import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, etb } from '../../../shared/api';
import { useI18n } from '../../../shared/lang';
import { Icon } from '../../../shared/brand';
import { Schematic } from '../../../shared/map/Schematic';
import { colors, radius, space, type, useStyles } from '../../../shared/theme';
import { Card, Chip, Empty, Loading, Notice, Screen, StatusChip } from '../../../shared/ui';

const SCOPES = ['active', 'done', 'all'];

/** A route preview on every history row: the same projection the tracker uses, drawn small. */
function RouteThumb({ order }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.thumb}>
      <Schematic
        compact
        pickup={order.restaurantLocation}
        dropoff={order.deliveryAddress?.lat != null ? order.deliveryAddress : null}
        courier={order.courierLocation}
        status={order.status}
        height={92}
      />
    </View>
  );
}

export default function Orders() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
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
    <Screen>
      <View style={styles.header}>
        <Text style={type.h1}>{t('orders.title')}</Text>
        <View style={styles.scopes}>
          {SCOPES.map((key) => (
            <Pressable key={key} onPress={() => setScope(key)} accessibilityRole="button" style={[styles.scope, scope === key && styles.scopeOn]}>
              <Text style={[styles.scopeText, scope === key && styles.scopeTextOn]}>{t(`orders.scope.${key}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Notice text={error} />

      {busy && !orders.length ? (
        <Loading label={t('common.loading')} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.muted} />}
          ListEmptyComponent={<Empty icon="orders" title={t('orders.empty')} body={t('orders.emptyBody')} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/track/${item.id}`)}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={type.h2} numberOfLines={1}>
                    {item.restaurantName}
                  </Text>
                  <Text style={type.small}>
                    {t('history.items', { count: item.items.reduce((n, i) => n + i.qty, 0) })} · {etb(item.totalCents)}
                  </Text>
                </View>
                <StatusChip status={item.status} label={t(`st.${item.status}`)} />
              </View>

              <RouteThumb order={item} />

              {item.eta?.reason ? (
                <View style={styles.eta}>
                  <Chip tone="accent" label={t('common.minutes', { n: item.eta.minutes })} icon="clock" />
                  <Text style={[type.small, { flex: 1 }]} numberOfLines={2}>
                    {item.eta.reason}
                  </Text>
                </View>
              ) : null}

              {item.courierName ? (
                <View style={styles.courier}>
                  <Icon name="jobs" size={15} color={colors.muted} />
                  <Text style={type.small}>{item.courierName}</Text>
                </View>
              ) : null}

              {item.cancelReason || item.rejectReason ? (
                <Text style={styles.reason}>{item.cancelReason || item.rejectReason}</Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    header: { paddingBottom: space.md },
    scopes: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
    scope: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 7
    },
    scopeOn: { borderColor: colors.ink, backgroundColor: colors.tint },
    scopeText: { fontSize: 13, color: colors.muted },
    scopeTextOn: { color: colors.ink, fontWeight: '700' },
    list: { gap: space.md, paddingBottom: space.xxl },
    rowTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    thumb: {
      marginTop: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden'
    },
    eta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
    courier: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
    reason: { marginTop: space.sm, fontSize: 13, fontWeight: '600', color: colors.accentInk }
  });
