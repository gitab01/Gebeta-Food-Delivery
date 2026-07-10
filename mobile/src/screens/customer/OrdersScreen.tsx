import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchMyOrders } from '../../store/slices/orderSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  ready: 'Ready', picked_up: 'Picked Up', on_the_way: 'On the Way',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

const OrdersScreen = ({ navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const { orders, isLoading } = useSelector((state: RootState) => state.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, []);

  const statusColor = (status: string) =>
    (COLORS.statusColors as any)[status] || COLORS.gray;

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
        <Text style={styles.title}>My Orders</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.orderCard}
            onPress={() =>
              ['picked_up', 'on_the_way'].includes(item.status)
                ? navigation.navigate('HomeTab', { screen: 'OrderTracking', params: { orderId: item._id } })
                : null
            }
            activeOpacity={0.85}
          >
            <View style={styles.orderHeader}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.restaurantName}>{item.restaurant?.name}</Text>
            <Text style={styles.itemsText}>
              {item.items?.length} item{item.items?.length !== 1 ? 's' : ''} · {item.pricing?.total?.toFixed(2)} ETB
            </Text>
            <Text style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
            {['picked_up', 'on_the_way'].includes(item.status) && (
              <View style={styles.trackBanner}>
                <Text style={styles.trackBannerText}>📍 Tap to track live</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>Start by ordering from a restaurant!</Text>
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
  orderCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, ...SHADOWS.small,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  orderNumber: { fontWeight: '800', fontSize: FONTS.sizes.md, color: COLORS.text.primary },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  restaurantName: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text.primary },
  itemsText: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2 },
  dateText: { fontSize: FONTS.sizes.xs, color: COLORS.gray, marginTop: 4 },
  trackBanner: {
    backgroundColor: '#FFF5F2', borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs, marginTop: SPACING.sm, alignItems: 'center',
  },
  trackBannerText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.sizes.sm },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyEmoji: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: { fontSize: FONTS.sizes.md, color: COLORS.text.secondary },
});

export default OrdersScreen;
