import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, etb, km } from '../../../shared/api';
import { useCart } from '../../../shared/cart';
import { useSession } from '../../../shared/session';
import { colors, radius, space, type } from '../../../shared/theme';
import { Button, Card, Chip, Loading, Notice, Screen } from '../../../shared/ui';

export default function Menu() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const cart = useCart();
  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  const where = useMemo(() => user?.addresses?.[0] || {}, [user]);

  useEffect(() => {
    let live = true;
    api
      .restaurant(id, where.lat, where.lng)
      .then((data) => live && setRestaurant(data.restaurant))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [id, where.lat, where.lng]);

  if (busy) return <Loading label="Opening the menu" />;
  if (!restaurant) return <Screen><Notice text={error || 'Restaurant not found'} /></Screen>;

  const outOfRange = restaurant.withinRange === false;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <View style={styles.hero}>
          <View style={[styles.emoji, { backgroundColor: restaurant.tint || colors.tint }]}>
            <Text style={{ fontSize: 30 }}>{restaurant.emoji || '◍'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h1}>{restaurant.name}</Text>
            <Text style={type.small}>
              {restaurant.cuisine.join(' · ')} · {km(restaurant.distanceMeters) || '—'} · ~{restaurant.avgPrepMinutes} min
            </Text>
          </View>
        </View>

        <Text style={[type.body, { marginTop: space.md }]}>{restaurant.description}</Text>

        <View style={styles.chips}>
          {restaurant.isOpen ? <Chip tone="green" label="Kitchen open" /> : <Chip tone="accent" label="Kitchen closed" />}
          <Chip label={`min ${etb(restaurant.minOrderCents)}`} />
          <Chip label={`${Math.round((restaurant.deliveryRadiusMeters || 0) / 1000)} km radius`} />
        </View>

        {outOfRange ? (
          <Notice text="This address is outside the kitchen’s delivery radius, so ordering is disabled." />
        ) : null}

        {restaurant.menu.map((section) => (
          <View key={section.id} style={{ marginTop: space.xl }}>
            <Text style={type.eyebrow}>{section.name}</Text>
            {section.items.map((item) => (
              <Card key={item.id} style={styles.dish}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { fontWeight: '700' }]}>
                    {item.emoji ? `${item.emoji} ` : ''}
                    {item.name}
                  </Text>
                  {item.description ? <Text style={type.small}>{item.description}</Text> : null}
                  <Text style={[type.small, { marginTop: 4 }]}>
                    {etb(item.priceCents)} · {item.prepMinutes} min prep
                  </Text>
                </View>
                <View style={styles.dishRight}>
                  <Button
                    label={item.available ? 'Add' : 'Out'}
                    disabled={!item.available || outOfRange}
                    variant={item.available ? 'primary' : 'ghost'}
                    onPress={() => cart.add(restaurant, item)}
                    style={styles.add}
                  />
                  {cart.lines.find((l) => l.menuItemId === item.id) ? (
                    <Text style={[type.small, { marginTop: 4 }]}>
                      ×{cart.lines.find((l) => l.menuItemId === item.id).qty}
                    </Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>

      {cart.count ? (
        <View style={styles.bar}>
          <View style={{ flex: 1 }}>
            <Text style={type.eyebrow}>{cart.count} item{cart.count > 1 ? 's' : ''}</Text>
            <Text style={[type.h2, { marginTop: 2 }]}>{etb(cart.subtotalCents)}</Text>
          </View>
          <Button
            label="Checkout"
            disabled={!restaurant.isOpen || outOfRange}
            onPress={() => router.push('/checkout')}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  emoji: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  dish: { marginTop: space.sm, flexDirection: 'row', gap: space.md, alignItems: 'center' },
  dishRight: { alignItems: 'center', minWidth: 78 },
  add: { minHeight: 40, paddingHorizontal: space.lg },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    paddingBottom: space.xl,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line
  }
});
