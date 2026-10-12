import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { api, etb } from '../../shared/api';
import { useCart } from '../../shared/cart';
import { useI18n } from '../../shared/lang';
import { useSession } from '../../shared/session';
import { colors, space, type, useStyles } from '../../shared/theme';
import { Button, Card, Chip, Field, Notice, Screen, Setting } from '../../shared/ui';

export default function Checkout() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { user } = useSession();
  const cart = useCart();
  const nav = useRouter();
  const [addressId, setAddressId] = useState(user?.addresses?.[0]?.id);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lines = cart.lines;
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0), [lines]);
  const method = user?.paymentMethods?.find((m) => m.isDefault) || user?.paymentMethods?.[0];

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
        nav.replace(`/track/${confirmed.order.id}`);
      } else {
        // A live gateway owns this step: the order stays PLACED until its webhook lands.
        cart.reset();
        setError(t('cart.awaitGateway'));
      }
    } catch (err) {
      setError(err.code === 'MAINTENANCE' ? t('cart.maintenance') : err.message);
      if (orderId) nav.push(`/track/${orderId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Notice text={error} />

        <Text style={type.eyebrow}>{t('cart.deliverTo')}</Text>
        {user.addresses?.length ? (
          <View style={styles.picks}>
            {user.addresses.map((a) => (
              <Card key={a.id} style={[styles.pick, addressId === a.id && styles.pickOn]} onPress={() => setAddressId(a.id)}>
                <View style={styles.radio}>
                  <View style={[styles.radioDot, addressId === a.id && styles.radioOn]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{a.label}</Text>
                  <Text style={type.small}>
                    {a.line}, {a.city}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <>
            <Notice text={t('cart.needAddress')} />
            <Button label={t('account.addAddress')} icon="add" variant="ghost" onPress={() => nav.push('/(tabs)/account')} />
          </>
        )}

        <Text style={[type.eyebrow, styles.section]}>{t('cart.items')}</Text>
        <Card>
          <View style={styles.items}>
            {lines.map((l) => (
              <View key={l.menuItemId} style={styles.line}>
                <Text style={[type.body, { flex: 1 }]}>
                  {l.qty} × {l.name}
                </Text>
                <Text style={type.small}>{etb(l.unitPriceCents * l.qty)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.rule} />
          <View style={styles.line}>
            <Text style={[type.small, { flex: 1 }]}>{t('cart.subtotalNote')}</Text>
            <Text style={[type.body, { fontWeight: '700' }]}>{etb(subtotal)}</Text>
          </View>
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Setting
            icon="card"
            label={t('cart.payingWith')}
            value={method ? `${t(`pay.${method.brand}`)}${method.last4 ? ` · ${method.last4}` : ''}` : t('pay.empty')}
            onPress={() => nav.push('/payment')}
            right={method?.isDefault ? <Chip tone="green" label={t('pay.default')} /> : null}
          />
        </Card>

        <Field
          label={t('cart.notes')}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={t('cart.notesHint')}
          style={{ marginTop: space.md }}
        />

        <Button label={t('cart.place')} icon="check" onPress={submit} loading={busy} disabled={busy || !addressId} />
        <Text style={[type.small, styles.foot]}>{t('cart.payFoot')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    section: { marginTop: space.xl, marginBottom: space.sm },
    picks: { gap: space.sm, marginTop: space.sm },
    pick: { flexDirection: 'row', gap: space.md, alignItems: 'center', borderColor: colors.line },
    pickOn: { borderColor: colors.ink, backgroundColor: colors.tint },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent' },
    radioOn: { backgroundColor: colors.ink },
    items: { gap: 4 },
    line: { flexDirection: 'row', gap: space.md, alignItems: 'baseline' },
    rule: { height: 1, backgroundColor: colors.line, marginVertical: space.md },
    foot: { marginTop: space.md, textAlign: 'center' }
  });
