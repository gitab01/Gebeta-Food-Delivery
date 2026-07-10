import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

interface Props {
  restaurant: any;
  onPress: () => void;
}

const RestaurantCard: React.FC<Props> = ({ restaurant, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Cover */}
      <View style={styles.coverPlaceholder}>
        <Text style={styles.coverEmoji}>🏪</Text>
        {!restaurant.isOpen && (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedText}>Closed</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
          {restaurant.rating?.average > 0 && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {restaurant.rating.average.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.cuisine} numberOfLines={1}>
          {restaurant.cuisine?.join(' · ') || 'Various cuisines'}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            🕒 {restaurant.estimatedDeliveryTime?.min ?? 20}-{restaurant.estimatedDeliveryTime?.max ?? 45} min
          </Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>
            {restaurant.deliveryFee > 0 ? `🚚 ${restaurant.deliveryFee} ETB` : '🚚 Free delivery'}
          </Text>
          {restaurant.minimumOrder > 0 && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>Min {restaurant.minimumOrder} ETB</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  coverPlaceholder: {
    height: 140,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  coverEmoji: { fontSize: 56 },
  closedOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedText: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: '800' },
  info: { padding: SPACING.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text.primary, flex: 1 },
  ratingBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  ratingText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: '#F57F17' },
  cuisine: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, flexWrap: 'wrap', gap: 4 },
  meta: { fontSize: FONTS.sizes.xs, color: COLORS.text.secondary },
  metaDot: { color: COLORS.gray },
});

export default RestaurantCard;
