import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, km } from '../../../shared/api';
import { SHORT, stageIndex } from '../../../shared/status';
import { useI18n } from '../../../shared/lang';
import { Icon } from '../../../shared/brand';
import { useSession } from '../../../shared/session';
import { useGrid } from '../../../shared/responsive';
import { colors, radius, space, type, useStyles } from '../../../shared/theme';
import { Card, Chip, Empty, Loading, Notice, Screen, StatusChip } from '../../../shared/ui';

const FALLBACK = { lat: 8.9973, lng: 38.7873 };

export default function NearYou() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { user } = useSession();
  const router = useRouter();
  const columns = useGrid(320, 2);
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

  // One chip per kitchen: a single busy kitchen should not fill the strip with repeats.
  const liveChips = useMemo(() => {
    const byKitchen = new Map();
    for (const row of live) {
      const key = row.restaurantId || row.restaurantName || 'kitchen';
      const seen = byKitchen.get(key);
      const keep = !seen || stageIndex(row.status) > stageIndex(seen.status) ? row : seen;
      byKitchen.set(key, { ...keep, count: (seen?.count || 0) + 1 });
    }
    return [...byKitchen.values()].slice(0, 4);
  }, [live]);

  return (
    <Screen wide>
      <View style={styles.header}>
        <View>
          <Text style={type.eyebrow}>{t('home.deliveringTo')}{where.label || where.line ? ` · ${where.label || where.line}` : ''}</Text>
          <Text style={[type.h1, { marginTop: 4 }]}>{t('home.kitchensOpen', { count: openCount })}</Text>
        </View>
        <Pressable onPress={load} accessibilityRole="button" hitSlop={8} style={styles.reload}>
          <Icon name="refresh" size={19} color={colors.muted} />
        </Pressable>
      </View>

      <Notice text={error} />

      {liveChips.length ? (
        <View style={styles.live}>
          <Text style={type.eyebrow}>{t('home.cookingNow')}</Text>
          <View style={styles.liveRow}>
            {liveChips.map((row) => (
              <Chip
                key={row.restaurantId || row.restaurantName}
                tone="accent"
                label={`${row.restaurantName || t('track.kitchen')} · ${SHORT[row.status] || t(`st.${row.status}`)}${row.count > 1 ? ` ×${row.count}` : ''}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {busy && !restaurants.length ? (
        <Loading label={t('home.finding')} />
      ) : (
        <FlatList
          data={restaurants}
          numColumns={columns}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.muted} />}
          ListEmptyComponent={<Empty title={t('home.empty')} body={t('home.emptyBody')} icon="store" />}
          renderItem={({ item }) => (
            <Card style={columns > 1 && styles.itemGrid} onPress={() => router.push(`/restaurant/${item.id}`)}>
              <View style={styles.itemTop}>
                <View style={[styles.mark, { backgroundColor: item.tint || colors.tint }]}>
                  <Text style={styles.markGlyph}>{item.emoji || '◍'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h2}>{item.name}</Text>
                  <Text style={type.small} numberOfLines={1}>
                    {item.cuisine.join(' · ')}
                  </Text>
                </View>
                {item.isOpen ? (
                  <StatusChip status="PREPARING" label={t('home.openNow')} />
                ) : (
                  <Chip label={t('home.closed')} icon="clock" />
                )}
              </View>

              <Text style={[type.body, { marginTop: space.md }]} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.meta}>
                <Text style={type.small}>{t('home.away', { distance: km(item.distanceMeters) || '—' })}</Text>
                <Text style={type.small}>{t('home.prep', { min: item.avgPrepMinutes })}</Text>
                <Text style={type.small}>
                  {item.ratingCount ? `${item.ratingStars.toFixed(1)} ★ (${item.ratingCount})` : t('home.notRated')}
                </Text>
                <Text style={type.small}>{t('home.dishes', { count: item.menuSummary?.available ?? 0 })}</Text>
              </View>

              {item.withinRange === false ? <Text style={styles.warn}>{t('home.outside')}</Text> : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingBottom: space.md },
    reload: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center'
    },
    live: { paddingBottom: space.md },
    liveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
    list: { gap: space.md, paddingBottom: space.xxl },
    item: {},
    itemGrid: { flex: 1, minWidth: 300 },
    itemTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    mark: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    markGlyph: { fontSize: 22 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 2, marginTop: space.md },
    warn: { marginTop: space.sm, fontSize: 13, fontWeight: '600', color: colors.accentInk }
  });
