import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { OrderProgress } from '../../../shared/OrderProgress';
import { LiveMap } from '../../../shared/map/LiveMap';
import { Icon } from '../../../shared/brand';
import { useI18n } from '../../../shared/lang';
import { colors, space, type, useStyles } from '../../../shared/theme';
import { useViewport } from '../../../shared/responsive';
import { Button, Card, Chip, Loading, Notice, Screen, StatusChip } from '../../../shared/ui';

const CANCELLABLE = ['PLACED', 'PAID', 'PREPARING', 'READY', 'ASSIGNED'];

export default function Track() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { size } = useViewport();
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [stars, setStars] = useState(0);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.order(id);
      setOrder(data.order);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Join the order room and stay in it across reconnects.
  useEffect(() => {
    const socket = realtime();
    const join = () => socket.emit('order:join', { orderId: id });
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('order:update', (payload) => {
      if (payload?.id === id) setOrder((current) => ({ ...payload, courierLocation: current?.courierLocation }));
    });
    socket.on('order:eta', (payload) => {
      if (payload?.orderId === id) setOrder((current) => (current ? { ...current, eta: payload.eta } : current));
    });
    socket.on('courier:location', (payload) => {
      if (payload?.lat == null) return;
      setOrder((current) => {
        if (!current) return current;
        const trail = [...(current.courierTrail || []), { lat: payload.lat, lng: payload.lng, at: payload.at }];
        return { ...current, courierLocation: { lat: payload.lat, lng: payload.lng, at: payload.at }, courierTrail: trail.slice(-150) };
      });
    });
    return () => {
      socket.off('connect', join);
      socket.off('order:update');
      socket.off('order:eta');
      socket.off('courier:location');
      socket.emit('order:leave', { orderId: id });
    };
  }, [id]);

  const cancel = async () => {
    setBusy(true);
    try {
      const data = await api.cancel(id, 'Changed my mind');
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rate = async () => {
    setBusy(true);
    try {
      const data = await api.rate(id, { restaurantStars: stars, courierStars: stars });
      setOrder(data.order);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const map = useMemo(
    () => ({
      pickup: order?.restaurantLocation ? { ...order.restaurantLocation, label: order.restaurantName } : null,
      dropoff: order?.deliveryAddress?.lat != null
        ? { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng, label: order.deliveryAddress.label || t('track.dropoff') }
        : null,
      courier: (() => {
        const label = order?.courierName || t('track.courier');
        if (order?.courierLocation?.lat != null) return { ...order.courierLocation, label };
        const trail = order?.courierTrail || [];
        const last = trail[trail.length - 1];
        return last?.lat != null ? { ...last, label } : null;
      })(),
      trail: order?.courierTrail || []
    }),
    [order, t]
  );

  if (busy && !order) return <Loading label={t('track.opening')} />;
  if (!order) return (
    <Screen>
      <Notice text={error} />
    </Screen>
  );

  const rated = Boolean(order.rated?.restaurant);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Text style={type.h1}>{order.restaurantName}</Text>
          <StatusChip status={order.status} label={t(`st.${order.status}`)} />
        </View>
        <Text style={[type.mono, { marginTop: 4 }]}>#{order.id.slice(-8)}</Text>

        <Notice text={error} />

        <Card style={styles.block}>
          <OrderProgress order={order} />
        </Card>

        <Card style={styles.block}>
          <LiveMap
            pickup={map.pickup}
            dropoff={map.dropoff}
            courier={map.courier}
            trail={map.trail}
            status={order.status}
            height={size === 'phone' ? 220 : 300}
          />
          <View style={styles.mapFoot}>
            <Text style={type.eyebrow}>{t('track.live')}</Text>
            <Text style={type.small}>
              {map.trail.length ? t('track.trail', { count: map.trail.length }) : t('track.noPosition')}
            </Text>
          </View>
        </Card>

        <Card style={styles.block}>
          <Text style={type.eyebrow}>{t('track.courier')}</Text>
          {order.courierName ? (
            <>
              <Text style={[type.h2, { marginTop: 6 }]}>{order.courierName}</Text>
              <Text style={type.small}>
                {order.courierVehicle} · {km(order.distanceMeters)}
              </Text>
            </>
          ) : (
            <Text style={[type.body, { marginTop: 6 }]}>
              {order.offer?.attempts ? t('track.attempts', { count: order.offer.attempts }) : t('track.noCourier')}
            </Text>
          )}
        </Card>

        <Card style={styles.block}>
          <Text style={type.eyebrow}>{t('track.items')}</Text>
          {order.items.map((item) => (
            <View key={item.menuItemId || item.name} style={styles.line}>
              <Text style={[type.body, { flex: 1 }]}>
                {item.qty} × {item.name}
              </Text>
              <Text style={type.small}>{etb(item.lineTotalCents)}</Text>
            </View>
          ))}
          <View style={styles.rule} />
          <View style={styles.line}>
            <Text style={type.small}>{t('cart.subtotal')}</Text>
            <Text style={type.small}>{etb(order.subtotalCents)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={type.small}>{t('cart.delivery')}</Text>
            <Text style={type.small}>{etb(order.deliveryFeeCents)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={type.small}>{t('cart.service')}</Text>
            <Text style={type.small}>{etb(order.serviceFeeCents)}</Text>
          </View>
          <View style={[styles.line, { marginTop: 4 }]}>
            <Text style={[type.body, { fontWeight: '700' }]}>{t('cart.total')}</Text>
            <Text style={type.h2}>{etb(order.totalCents)}</Text>
          </View>
        </Card>

        {CANCELLABLE.includes(order.status) ? (
          <Button label={t('track.cancel')} variant="danger" onPress={cancel} style={{ marginTop: space.md }} />
        ) : null}

        {order.status === 'DELIVERED' && !rated ? (
          <Card style={[styles.block, { marginTop: space.md }]}>
            <Text style={type.eyebrow}>{t('track.rate')}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setStars(n)} hitSlop={6} accessibilityRole="button">
                  <Icon name={n <= stars ? 'star' : 'star-outline'} size={30} color={n <= stars ? colors.amber : colors.line} />
                </Pressable>
              ))}
            </View>
            <Button label={t('track.sendRating')} disabled={!stars} onPress={rate} loading={busy} />
          </Card>
        ) : null}

        {sent || rated ? (
          <View style={{ marginTop: space.md }}>
            <Chip tone="green" label={t('track.thanks', { stars: stars || order.customerRatingStars || 0 })} icon="check" />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
    block: { marginTop: space.md },
    mapFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, marginTop: space.md },
    line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 3 },
    rule: { height: 1, backgroundColor: colors.line, marginVertical: space.sm },
    stars: { flexDirection: 'row', gap: space.sm, marginVertical: space.md }
  });
