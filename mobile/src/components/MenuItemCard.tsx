import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

interface Props {
  item: any;
  onAdd: () => void;
}

const MenuItemCard: React.FC<Props> = ({ item, onAdd }) => (
  <View style={styles.card}>
    {/* Left: Image placeholder */}
    <View style={styles.imagePlaceholder}>
      <Text style={styles.imageEmoji}>🍽️</Text>
    </View>

    {/* Right: Info */}
    <View style={styles.info}>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={styles.badges}>
          {item.isVegetarian && (
            <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.badgeText, { color: COLORS.success }]}>🌿 Veg</Text>
            </View>
          )}
          {item.isSpicy && (
            <View style={[styles.badge, { backgroundColor: '#FFEBEE' }]}>
              <Text style={[styles.badgeText, { color: COLORS.error }]}>🌶️ Spicy</Text>
            </View>
          )}
        </View>
      </View>

      {item.description && (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.price}>{item.price.toFixed(2)} ETB</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageEmoji: { fontSize: 32 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.xs },
  name: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text.primary, flex: 1 },
  badges: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  description: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  price: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.primary },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.sm },
});

export default MenuItemCard;
