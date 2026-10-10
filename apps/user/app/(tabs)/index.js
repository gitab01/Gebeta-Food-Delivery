import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, km } from '../../../shared/api';
import { useSession } from '../../../shared/session';
import { colors, space, type } from '../../../shared/theme';
import { Card, Chip, Empty, Loading, Screen, StatusChip } from '../../../shared/ui';

const FALLBACK = { lat: 8.9973, lng: 38.7873 };

export default function NearYou() {
  const { user } = useSession();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState([]);
  const [live, setLive] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const where = useMemo(() => user?.addresses?.[0] || FALLBACK, [user]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [list, strip] = await Promise.all([api.restaurants(where.lat, where.lng), api.live()]);
      setRestaurants(list.restaurants);
      setLive(strip.live || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [where.lat, where.lng]);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = restaurants.filter((r) => r.isOpen && r.withinRange !== false).length;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Text style={type.eyebrow}>Delivering to {where.label || where.line}</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>
          {openCount} kitchens open near you
        </Text>
        {error ? <Text style={[type.small, { color: colors.accentInk }]}>{error}</Text> : null}
      </View>

      {live.length ? (
        <View style={styles.live}>
          <Text style={type.eyebrow}>Cooking right now</Text>
          <View style={styles.liveRow}>
            {live.slice(0, 4).map((row, i) => (
              <Chip key={`${row.restaurantId}-${i}`} tone="accent" label={`${row.restaurantName || 'Kitchen'} · ${row.status}`} />
            ))}
          </View>
        </View>
      ) : null}

      {busy && !restaurants.length ? (
        <Loading label="Finding kitchens near you" />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.muted} />}
          ListEmptyComponent={<Empty title="No kitchens yet" body="Run the backend seed to load the Addis Ababa demo restaurants." />}
          renderItem={({ item }) => (
            <Card style={styles.item} onPress={() => router.push(`/restaurant/${item.id}`)}>
              <View style={styles.itemTop}>
                <View style={[styles.emoji, { backgroundColor: item.tint || colors.tint }]}>
                  <Text style={{ fontSize: 22 }}>{item.emoji || '◍'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h2}>{item.name}</Text>
                  <Text style={type.small}>{item.cuisine.join(' · ')}</Text>
                </View>
                {item.isOpen ? (
                  <StatusChip status="PREPARING" label="Open" />
                ) : (
                  <Chip label="Closed" />
                )}
              </View>

              <Text style={[type.body, { marginTop: space.md }]}>{item.description}</Text>

              <View style={styles.meta}>
                <Text style={type.small}>{km(item.distanceMeters) || '—'} away</Text>
                <Text style={type.small}>~{item.avgPrepMinutes} min prep</Text>
                <Text style={type.small}>
                  {item.ratingCount ? `${item.ratingStars.toFixed(1)} ★ (${item.ratingCount})` : 'not rated yet'}
                </Text>
                <Text style={type.small}>{item.menuSummary?.available ?? 0} dishes on</Text>
              </View>

              {item.withinRange === false ? (
                <Text style={[styles.warn, { color: colors.accentInk }]}>Outside this kitchen’s delivery radius</Text>
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
  live: { paddingHorizontal: space.lg, paddingBottom: space.md },
  liveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  item: { marginBottom: space.md },
  itemTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  emoji: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 2, marginTop: space.md },
  warn: { marginTop: space.sm, fontSize: 13, fontWeight: '600' }
});
