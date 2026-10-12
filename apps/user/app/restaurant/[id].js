import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, etb, km } from '../../../shared/api';
import { useCart } from '../../../shared/cart';
import { useI18n } from '../../../shared/lang';
import { LiveMap } from '../../../shared/map/LiveMap';
import { useSession } from '../../../shared/session';
import { colors, radius, space, type, useStyles } from '../../../shared/theme';
import { Button, Card, Chip, Loading, Notice, Screen } from '../../../shared/ui';

export default function Menu() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
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

  if (busy) return <Loading label={t('menu.opening')} />;
  if (!restaurant) return (
    <Screen>
      <Notice text={error || t('menu.notFound')} />
    </Screen>
  );

  const outOfRange = restaurant.withinRange === false;
  const dropoff = where.lat != null ? { lat: where.lat, lng: where.lng, label: where.label || where.line || t('track.dropoff') } : null;
  const quantityOf = (itemId) => cart.lines.find((l) => l.menuItemId === itemId)?.qty || 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <View style={[styles.mark, { backgroundColor: restaurant.tint || colors.tint }]}>
              <Text style={styles.markGlyph}>{restaurant.emoji || '◍'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>{restaurant.name}</Text>
              <Text style={type.small}>
                {restaurant.cuisine.join(' · ')} · {km(restaurant.distanceMeters) || '—'} · {t('menu.prep', { min: restaurant.avgPrepMinutes })}
              </Text>
            </View>
          </View>

          <Text style={[type.body, styles.description]}>{restaurant.description}</Text>

          <View style={styles.chips}>
            {restaurant.isOpen ? (
              <Chip tone="green" label={t('menu.openKitchen')} icon="fire" />
            ) : (
              <Chip tone="accent" label={t('menu.closedKitchen')} icon="clock" />
            )}
            <Chip label={t('menu.min', { amount: etb(restaurant.minOrderCents) })} icon="money" />
            <Chip label={t('menu.radius', { km: Math.round((restaurant.deliveryRadiusMeters || 0) / 1000) })} icon="map" />
          </View>

          <Notice text={outOfRange ? t('menu.outOfRange') : error} />

          {restaurant.lat != null ? (
            <Card style={styles.block}>
              <Text style={type.eyebrow}>{t('track.kitchen')}</Text>
              <LiveMap
                pickup={{ lat: restaurant.lat, lng: restaurant.lng, label: restaurant.name }}
                dropoff={dropoff}
                status={restaurant.isOpen ? 'ASSIGNED' : null}
                height={150}
                style={{ marginTop: space.md }}
              />
              <Text style={[type.small, { marginTop: space.sm }]}>{restaurant.address}</Text>
            </Card>
          ) : null}

          {restaurant.menu.map((section) => (
            <View key={section.id} style={styles.block}>
              <Text style={type.eyebrow}>{section.name}</Text>
              {section.items.map((item) => {
                const qty = quantityOf(item.id);
                return (
                  <Card key={item.id} style={styles.dish}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { fontWeight: '700' }]}>
                        {item.emoji ? `${item.emoji} ` : ''}
                        {item.name}
                      </Text>
                      {item.description ? <Text style={type.small}>{item.description}</Text> : null}
                      <Text style={[type.small, { marginTop: 4 }]}>
                        {etb(item.priceCents)} · {t('menu.prep', { min: item.prepMinutes })}
                      </Text>
                    </View>
                    <View style={styles.dishRight}>
                      <Button
                        label={item.available ? t('menu.add') : t('menu.soldOut')}
                        icon={item.available ? 'add' : undefined}
                        disabled={!item.available || outOfRange || !restaurant.isOpen}
                        variant={item.available ? 'primary' : 'ghost'}
                        onPress={() => cart.add(restaurant, item)}
                        narrow
                      />
                      {qty ? <Text style={[type.small, { marginTop: 4 }]}>{t('menu.inCart', { count: qty })}</Text> : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </Screen>

      {cart.count ? (
        <View style={styles.bar}>
          <View style={{ flex: 1 }}>
            <Text style={type.eyebrow}>{t('menu.cartCount', { count: cart.count })}</Text>
            <Text style={[type.h2, { marginTop: 2 }]}>{etb(cart.subtotalCents)}</Text>
          </View>
          <Button
            label={t('menu.checkout')}
            icon="cart"
            disabled={!restaurant.isOpen || outOfRange}
            onPress={() => router.push('/checkout')}
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: 120 },
    hero: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
    mark: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    markGlyph: { fontSize: 30 },
    description: { marginTop: space.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
    block: { marginTop: space.xl },
    dish: { marginTop: space.sm, flexDirection: 'row', gap: space.md, alignItems: 'center' },
    dishRight: { alignItems: 'stretch', minWidth: 96 },
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
