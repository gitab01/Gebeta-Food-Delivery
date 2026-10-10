import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { api } from '../../shared/api';
import { useCart } from '../../shared/cart';
import { useSession } from '../../shared/session';
import { colors, radius, space, type } from '../../shared/theme';
import { Button, Card, Field, Notice, Screen } from '../../shared/ui';

export default function Checkout() {
  const { user } = useSession();
  const cart = useCart();
  const router = useRouter();
  const [addressId, setAddressId] = useState(user?.addresses?.[0]?.id);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lines = cart.lines;
  const totalGuess = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0),
    [lines]
  );

  if (!user) return <Redirect href="/login" />;
  if (!lines.length) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setBusy(true);
    setError('');
    let orderId = null;
    try {
      const created = await api.createOrder({
        restaurantId: cart.restaurantId,
        lines: lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
        addressId,
        notes
      });
      orderId = created.order.id;
      const { intent, gateway } = await api.paymentIntent(orderId);
      if (gateway === 'mock') {
        const confirmed = await api.confirmMockPayment(intent.paymentId);
        cart.reset();
        router.replace(`/track/${confirmed.order.id}`);
      } else {
        // A live gateway owns this step: the order stays PLACED until its webhook lands.
        cart.reset();
        setError('Tap pay in your payment app — the order turns PAID when the gateway confirms it.');
      }
    } catch (err) {
      setError(err.message);
      if (orderId) router.push(`/track/${orderId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Notice text={error} />

        <Text style={type.eyebrow}>Deliver to</Text>
        {user.addresses?.length ? (
          user.addresses.map((a) => (
            <Card
              key={a.id}
              style={[styles.pick, addressId === a.id && styles.pickOn]}
              onPress={() => setAddressId(a.id)}
            >
              <Text style={[type.body, { fontWeight: '700' }]}>{a.label}</Text>
              <Text style={type.small}>{a.line}, {a.city}</Text>
            </Card>
          ))
        ) : (
          <Notice text="Add an address on the Account tab first." />
        )}

        <Text style={[type.eyebrow, { marginTop: space.xl, marginBottom: space.sm }]}>Order</Text>
        <Card>
          {lines.map((l) => (
            <View key={l.menuItemId} style={styles.line}>
              <Text style={{ flex: 1 }}>{l.qty} × {l.name}</Text>
              <Text style={type.small}>{(l.unitPriceCents * l.qty / 100).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.rule} />
          <View style={styles.line}>
            <Text style={[type.small, { flex: 1 }]}>Subtotal (delivery + service fees are added by the server)</Text>
            <Text style={[type.body, { fontWeight: '700' }]}>{(totalGuess / 100).toFixed(2)}</Text>
          </View>
        </Card>

        <Field label="Notes for the kitchen" value={notes} onChangeText={setNotes} multiline />

        <Button label="Place order and pay" onPress={submit} loading={busy} disabled={!addressId} />
        <Text style={[type.small, { marginTop: space.md, textAlign: 'center' }]}>
          The card step is a local gateway stand-in until Stripe keys are configured.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pick: { marginTop: space.sm, borderColor: colors.line },
  pickOn: { borderColor: colors.ink, backgroundColor: colors.tint },
  line: { flexDirection: 'row', gap: space.md, paddingVertical: 4 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: space.md }
});
