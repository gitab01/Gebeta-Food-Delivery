import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchRestaurantDetails } from '../../store/slices/restaurantSlice';
import { addItem } from '../../store/slices/cartSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import MenuItemCard from '../../components/MenuItemCard';

const RestaurantScreen = ({ route, navigation }: any) => {
  const { restaurantId } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { selectedRestaurant: restaurant, menu, isLoading } = useSelector(
    (state: RootState) => state.restaurants
  );
  const { restaurantId: cartRestaurantId, items: cartItems } = useSelector((state: RootState) => state.cart);

  useEffect(() => {
    dispatch(fetchRestaurantDetails(restaurantId));
  }, [restaurantId]);

  const handleAddToCart = (item: any) => {
    if (cartRestaurantId && cartRestaurantId !== restaurantId) {
      Alert.alert(
        'Clear cart?',
        'You have items from another restaurant. Adding this item will clear your cart.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Add',
            onPress: () => addItemToCart(item),
          },
        ]
      );
    } else {
      addItemToCart(item);
    }
  };

  const addItemToCart = (item: any) => {
    dispatch(
      addItem({
        restaurantId,
        restaurantName: restaurant?.name || '',
        item: {
          menuItemId: item._id,
          name: item.name,
          price: item.price,
          quantity: 1,
          image: item.image,
        },
      })
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!restaurant) return null;

  const sections = Object.entries(menu).map(([category, items]) => ({
    title: category,
    data: items as any[],
  }));

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.heroContent}>
          <Text style={styles.restaurantEmoji}>🏪</Text>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.restaurantCuisine}>{restaurant.cuisine?.join(' · ')}</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoBadge}>
              <Text>⭐ {restaurant.rating?.average?.toFixed(1) || '0.0'}</Text>
            </View>
            <View style={styles.infoBadge}>
              <Text>🕒 {restaurant.estimatedDeliveryTime?.min}-{restaurant.estimatedDeliveryTime?.max} min</Text>
            </View>
            <View style={styles.infoBadge}>
              <Text>🚚 {restaurant.deliveryFee > 0 ? `${restaurant.deliveryFee} ETB` : 'Free delivery'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Menu */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.categoryHeader}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <MenuItemCard item={item} onAdd={() => handleAddToCart(item)} />
        )}
        contentContainerStyle={styles.menuContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
      />

      {/* Cart Button */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => navigation.navigate('CartTab')}
        >
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
          <Text style={styles.cartButtonText}>View Cart</Text>
          <Text style={styles.cartButtonText}>→</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  backBtnText: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: '700' },
  heroContent: { alignItems: 'center' },
  restaurantEmoji: { fontSize: 48, marginBottom: SPACING.xs },
  restaurantName: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.white },
  restaurantCuisine: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  infoRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  infoBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryHeader: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuContent: { paddingBottom: 100 },
  cartButton: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.large,
  },
  cartBadge: {
    backgroundColor: COLORS.white,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: { color: COLORS.primary, fontWeight: '800', fontSize: FONTS.sizes.sm },
  cartButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.lg },
});

export default RestaurantScreen;
