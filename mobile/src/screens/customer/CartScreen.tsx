import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { removeItem, updateQuantity, clearCart, selectCartTotal } from '../../store/slices/cartSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const CartScreen = ({ navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, restaurantName } = useSelector((state: RootState) => state.cart);
  const total = useSelector(selectCartTotal);

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Add items from a restaurant to get started</Text>
      </SafeAreaView>
    );
  }

  const deliveryFee = 30;
  const serviceFee = parseFloat((total * 0.05).toFixed(2));
  const tax = parseFloat((total * 0.15).toFixed(2));
  const grandTotal = total + deliveryFee + serviceFee + tax;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.restaurantName}>{restaurantName}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.menuItemId}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{item.price.toFixed(2)} ETB each</Text>
            </View>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => dispatch(updateQuantity({ menuItemId: item.menuItemId, quantity: item.quantity - 1 }))}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => dispatch(updateQuantity({ menuItemId: item.menuItemId, quantity: item.quantity + 1 }))}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.itemSubtotal}>{(item.price * item.quantity).toFixed(2)} ETB</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 220 }}
      />

      {/* Order Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        {[
          { label: 'Subtotal', value: total },
          { label: 'Delivery fee', value: deliveryFee },
          { label: 'Service fee (5%)', value: serviceFee },
          { label: 'Tax (15%)', value: tax },
        ].map((row) => (
          <View key={row.label} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue}>{row.value.toFixed(2)} ETB</Text>
          </View>
        ))}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{grandTotal.toFixed(2)} ETB</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate('HomeTab', { screen: 'Checkout' })}
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearBtn} onPress={() => dispatch(clearCart())}>
          <Text style={styles.clearBtnText}>Clear Cart</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  emptyEmoji: { fontSize: 72, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.text.primary },
  emptySubtitle: { fontSize: FONTS.sizes.md, color: COLORS.text.secondary, marginTop: SPACING.xs },
  header: { padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text.primary },
  restaurantName: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text.primary },
  itemPrice: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary, marginTop: 2 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.sm },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.lg },
  qtyText: { fontSize: FONTS.sizes.md, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  itemSubtotal: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text.primary, minWidth: 80, textAlign: 'right' },
  separator: { height: 1, backgroundColor: COLORS.border },
  summary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    ...SHADOWS.large,
  },
  summaryTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', marginBottom: SPACING.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  summaryLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  summaryValue: { fontSize: FONTS.sizes.sm, color: COLORS.text.primary },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.xs },
  totalLabel: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text.primary },
  totalValue: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.primary },
  checkoutBtn: {
    backgroundColor: COLORS.primary, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl, alignItems: 'center', marginTop: SPACING.md,
  },
  checkoutBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.lg },
  clearBtn: { alignItems: 'center', marginTop: SPACING.sm },
  clearBtnText: { color: COLORS.error, fontWeight: '600' },
});

export default CartScreen;
