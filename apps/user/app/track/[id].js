import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, etb, km, realtime } from '../../../shared/api';
import { LABEL } from '../../../shared/status';
import { OrderProgress } from '../../../shared/OrderProgress';
import { Tracker } from '../../../shared/Tracker';
import { colors, radius, space, type } from '../../../shared/theme';
import { Button, Card, Chip, Loading, Notice, Screen, StatusChip } from '../../../shared/ui';

const CANCELLABLE = ['PLACED', 'PAID', 'PREPARING', 'READY', 'ASSIGNED'];

export default function Track() {
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [stars, setStars] = useState(0);
  const [sent, setSent] = useState(false);
  const socketRef = useRef(null);

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
    socketRef.current = socket;
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
      if (payload?.lat != null) {
        setOrder((current) => (current ? { ...current, courierLocation: { lat: payload.lat, lng: payload.lng, at: payload.at } } : current));
      }
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

  if (busy && !order) return <Loading label="Opening your order" />;
  if (!order) return <Screen><Notice text={error} /></Screen>;

  const rated = Boolean(order.rated?.restaurant);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <View style={styles.titleRow}>
          <Text style={type.h1}>{order.restaurantName}</Text>
          <StatusChip status={order.status} label={LABEL[order.status]} />
        </View>
        <Text style={[type.mono, { marginTop: 4 }]}>#{order.id.slice(-8)}</Text>

        <Notice text={error} />

        <Card style={styles.block}>
          <OrderProgress order={order} />
        </Card>

        <Card style={styles.block}>
          <Text style={type.eyebrow}>Live route</Text>
          <Tracker order={order} />
        </Card>

        {order.courierName ? (
          <Card style={styles.block}>
            <Text style={type.eyebrow}>Courier</Text>
            <Text style={[type.h2, { marginTop: 6 }]}>{order.courierName}</Text>
            <Text style={type.small}>
              {order.courierVehicle} · {km(order.distanceMeters)} from kitchen to door
            </Text>
          </Card>
        ) : (
          <Card style={styles.block}>
            <Text style={type.eyebrow}>Courier</Text>
            <Text style={[type.body, { marginTop: 6 }]}>
              {order.offer?.attempts ? `Looking for a rider — ${order.offer.attempts} offered so far` : 'Looking for a rider'}
            </Text>
          </Card>
        )}

        <Card style={styles.block}>
          <Text style={type.eyebrow}>Order</Text>
          {order.items.map((item) => (
            <View key={item.menuItemId || item.name} style={styles.line}>
              <Text style={{ flex: 1 }}>
                {item.qty} × {item.name}
              </Text>
              <Text style={type.small}>{(item.lineTotalCents / 100).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.rule} />
          <View style={styles.line}>
            <Text style={type.small}>Subtotal</Text>
            <Text style={type.small}>{etb(order.subtotalCents)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={type.small}>Delivery</Text>
            <Text style={type.small}>{etb(order.deliveryFeeCents)}</Text>
          </View>
          <View style={styles.line}>
            <Text style={type.small}>Service</Text>
            <Text style={type.small}>{etb(order.serviceFeeCents)}</Text>
          </View>
          <View style={[styles.line, { marginTop: 4 }]}>
            <Text style={[type.body, { fontWeight: '700' }]}>Total</Text>
            <Text style={[type.h2]}>{etb(order.totalCents)}</Text>
          </View>
        </Card>

        {CANCELLABLE.includes(order.status) ? (
          <Button label="Cancel this order" variant="danger" onPress={cancel} style={{ marginTop: space.md }} />
        ) : null}

        {order.status === 'DELIVERED' && !rated ? (
          <Card style={[styles.block, { marginTop: space.md }]}>
            <Text style={type.eyebrow}>How was it?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Text key={n} onPress={() => setStars(n)} style={[styles.star, n <= stars && styles.starOn]}>
                  ★
                </Text>
              ))}
            </View>
            <Button label="Send rating" disabled={!stars} onPress={rate} loading={busy} />
          </Card>
        ) : null}

        {sent || rated ? (
          <View style={{ marginTop: space.md }}>
            <Chip tone="green" label={`Thanks — ${stars}★ recorded`} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  block: { marginTop: space.md },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 3 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: space.sm },
  stars: { flexDirection: 'row', gap: space.sm, marginVertical: space.md },
  star: { fontSize: 28, color: colors.line },
  starOn: { color: colors.accent }
});
