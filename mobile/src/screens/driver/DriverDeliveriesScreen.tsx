import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchMyOrders } from '../../store/slices/orderSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const DriverDeliveriesScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { orders, isLoading } = useSelector((state: RootState) => state.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Deliveries</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.deliveryCard}>
            <View style={styles.cardRow}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text style={styles.amount}>{item.pricing?.total?.toFixed(2)} ETB</Text>
            </View>
            <Text style={styles.restaurantName}>{item.restaurant?.name}</Text>
            <Text style={styles.address}>{item.deliveryAddress?.street}, {item.deliveryAddress?.city}</Text>
            <View style={[styles.statusBadge, { backgroundColor: COLORS.success + '20' }]}>
              <Text style={[styles.statusText, { color: COLORS.success }]}>{item.status}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🚴</Text>
            <Text style={styles.emptyTitle}>No deliveries yet</Text>
            <Text style={styles.emptySubtitle}>Go online to start receiving orders!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text.primary },
  list: { padding: SPACING.lg, gap: SPACING.md },
  deliveryCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, ...SHADOWS.small,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  orderNumber: { fontWeight: '700', fontSize: FONTS.sizes.md },
  amount: { fontWeight: '700', fontSize: FONTS.sizes.md, color: COLORS.success },
  restaurantName: { fontSize: FONTS.sizes.md, color: COLORS.text.primary, fontWeight: '600' },
  address: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full, marginTop: SPACING.sm },
  statusText: { fontSize: FONTS.sizes.xs, fontWeight: '700', textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyEmoji: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: { fontSize: FONTS.sizes.md, color: COLORS.text.secondary },
});

export default DriverDeliveriesScreen;
