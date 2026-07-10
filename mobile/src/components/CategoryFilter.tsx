import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface Props {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

const CategoryFilter: React.FC<Props> = ({ categories, selected, onSelect }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.container}
  >
    {categories.map((cat) => (
      <TouchableOpacity
        key={cat}
        style={[styles.chip, selected === cat && styles.chipActive]}
        onPress={() => onSelect(cat)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, selected === cat && styles.chipTextActive]}>{cat}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  chipTextActive: {
    color: COLORS.white,
  },
});

export default CategoryFilter;
