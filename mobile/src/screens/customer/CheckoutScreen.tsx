import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { placeOrder } from '../../store/slices/orderSlice';
import { clearCart, selectCartTotal } from '../../store/slices/cartSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const CheckoutScreen = ({ navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, restaurantId } = useSelector((state: RootState) => state.cart);
  const total = useSelector(selectCartTotal);
  const { isLoading } = useSelector((state: RootState) => state.orders);

  const [address, setAddress] = useState({ street: '', city: 'Addis Ababa', instructions: '' });
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');

  const deliveryFee = 30;
  const serviceFee = parseFloat((total * 0.05).toFixed(2));
  const tax = parseFloat((total * 0.15).toFixed(2));
  const grandTotal = total + deliveryFee + serviceFee + tax;

  const handlePlaceOrder = async () => {
    if (!address.street.trim()) {
      Alert.alert('Error', 'Please enter a delivery address');
      return;
    }

    const orderData = {
      restaurantId,
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        customizations: item.customizations || [],
      })),
      deliveryAddress: {
        street: address.street,
        city: address.city,
        instructions: address.instructions,
      },
      paymentMethod,
    };

    const result = await dispatch(placeOrder(orderData));

    if (placeOrder.fulfilled.match(result)) {
      dispatch(clearCart());
      navigation.navigate('OrderTracking', { orderId: result.payload._id });
    } else {
      Alert.alert('Error', (result.payload as string) || 'Failed to place order');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Delivery Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Street address"
            value={address.street}
            onChangeText={(v) => setAddress({ ...address, street: v })}
            placeholderTextColor={COLORS.gray}
          />
          <TextInput
            style={styles.input}
            placeholder="City"
            value={address.city}
            onChangeText={(v) => setAddress({ ...address, city: v })}
            placeholderTextColor={COLORS.gray}
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Delivery instructions (optional)"
            value={address.instructions}
            onChangeText={(v) => setAddress({ ...address, instructions: v })}
            placeholderTextColor={COLORS.gray}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Payment Method</Text>
          {(['card', 'cash'] as const).map((method) => (
            <TouchableOpacity
              key={method}
              style={[styles.paymentOption, paymentMethod === method && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={styles.paymentIcon}>{method === 'card' ? '💳' : '💵'}</Text>
              <Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextActive]}>
                {method === 'card' ? 'Credit / Debit Card' : 'Cash on Delivery'}
              </Text>
              {paymentMethod === method && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧾 Order Summary</Text>
          {items.map((item) => (
            <View key={item.menuItemId} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{item.name} x{item.quantity}</Text>
              <Text style={styles.summaryValue}>{(item.price * item.quantity).toFixed(2)} ETB</Text>
            </View>
          ))}
          <View style={styles.divider} />
          {[
            { label: 'Delivery fee', value: deliveryFee },
            { label: 'Service fee', value: serviceFee },
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
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeOrderBtn, isLoading && styles.disabledBtn]}
          onPress={handlePlaceOrder}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.placeOrderText}>Place Order · {grandTotal.toFixed(2)} ETB</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 100 },
  backBtn: { marginBottom: SPACING.sm },
  backText: { color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text.primary, marginBottom: SPACING.lg },
  section: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.small,
  },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', marginBottom: SPACING.md },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.md, marginBottom: SPACING.sm, color: COLORS.text.primary,
  },
  multilineInput: { height: 60, textAlignVertical: 'top' },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  paymentOptionActive: { borderColor: COLORS.primary, backgroundColor: '#FFF5F2' },
  paymentIcon: { fontSize: 24 },
  paymentText: { flex: 1, fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text.secondary },
  paymentTextActive: { color: COLORS.primary },
  checkMark: { color: COLORS.primary, fontWeight: '800', fontSize: FONTS.sizes.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  summaryLabel: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  summaryValue: { fontSize: FONTS.sizes.sm, color: COLORS.text.primary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  totalRow: { marginTop: SPACING.xs },
  totalLabel: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text.primary },
  totalValue: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.primary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.lg, backgroundColor: COLORS.white, ...SHADOWS.large,
  },
  placeOrderBtn: {
    backgroundColor: COLORS.primary, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl, alignItems: 'center',
  },
  disabledBtn: { opacity: 0.7 },
  placeOrderText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.lg },
});

export default CheckoutScreen;
