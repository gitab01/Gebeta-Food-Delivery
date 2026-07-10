import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const DriverEarningsScreen = () => (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Earnings</Text>
    </View>
    <View style={styles.heroCard}>
      <Text style={styles.heroLabel}>Total Earnings</Text>
      <Text style={styles.heroAmount}>0.00 ETB</Text>
      <Text style={styles.heroSub}>This week</Text>
    </View>
    {[
      { label: 'Today', value: '0.00 ETB', icon: '📅' },
      { label: 'This Month', value: '0.00 ETB', icon: '📆' },
      { label: 'All Time', value: '0.00 ETB', icon: '💰' },
      { label: 'Total Deliveries', value: '0', icon: '📦' },
    ].map((item) => (
      <View key={item.label} style={styles.statRow}>
        <Text style={styles.statIcon}>{item.icon}</Text>
        <Text style={styles.statLabel}>{item.label}</Text>
        <Text style={styles.statValue}>{item.value}</Text>
      </View>
    ))}
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text.primary },
  heroCard: {
    margin: SPACING.lg, backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, alignItems: 'center',
    ...SHADOWS.medium,
  },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: FONTS.sizes.md },
  heroAmount: { color: COLORS.white, fontSize: FONTS.sizes.hero, fontWeight: '800', marginVertical: SPACING.xs },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: FONTS.sizes.sm },
  statRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small, gap: SPACING.md,
  },
  statIcon: { fontSize: 24 },
  statLabel: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text.secondary },
  statValue: { fontWeight: '700', fontSize: FONTS.sizes.md, color: COLORS.text.primary },
});

export default DriverEarningsScreen;
