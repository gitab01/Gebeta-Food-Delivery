import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchOrder } from '../../store/slices/orderSlice';
import { trackOrder, untrackOrder } from '../../services/socket';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const ORDER_STATUS_STEPS = [
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
  { key: 'picked_up', label: 'Picked Up', icon: '🏍️' },
  { key: 'on_the_way', label: 'On the Way', icon: '📍' },
  { key: 'delivered', label: 'Delivered', icon: '🎉' },
];

const OrderTrackingScreen = ({ route, navigation }: any) => {
  const { orderId } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { currentOrder, driverLocation } = useSelector((state: RootState) => state.orders);
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    dispatch(fetchOrder(orderId));
    trackOrder(orderId);

    // Pulse animation for driver marker
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      untrackOrder(orderId);
      pulse.stop();
    };
  }, [orderId]);

  useEffect(() => {
    if (driverLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: driverLocation.lat,
        longitude: driverLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [driverLocation]);

  const currentStepIndex = ORDER_STATUS_STEPS.findIndex(
    (s) => s.key === currentOrder?.status
  );

  const deliveryAddress = currentOrder?.deliveryAddress;

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: driverLocation?.lat || 9.0192,
            longitude: driverLocation?.lng || 38.7525,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Driver Marker */}
          {driverLocation && (
            <Marker
              coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
              title="Your Driver"
            >
              <Animated.View style={[styles.driverMarker, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.driverMarkerText}>🏍️</Text>
              </Animated.View>
            </Marker>
          )}

          {/* Delivery Address Marker */}
          {deliveryAddress?.coordinates && (
            <Marker
              coordinate={{
                latitude: deliveryAddress.coordinates.lat,
                longitude: deliveryAddress.coordinates.lng,
              }}
              title="Your Location"
            >
              <View style={styles.destinationMarker}>
                <Text>🏠</Text>
              </View>
            </Marker>
          )}
        </MapView>

        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Order Status Panel */}
      <View style={styles.panel}>
        <Text style={styles.orderNumber}>Order {currentOrder?.orderNumber}</Text>

        {/* Driver Info */}
        {currentOrder?.driver && (
          <View style={styles.driverInfo}>
            <Text style={styles.driverAvatar}>🧑</Text>
            <View>
              <Text style={styles.driverName}>{currentOrder.driver.name}</Text>
              <Text style={styles.driverRole}>Your delivery driver</Text>
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <Text>📞</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress Steps */}
        <View style={styles.stepsContainer}>
          {ORDER_STATUS_STEPS.map((step, index) => {
            const isDone = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <View key={step.key} style={styles.step}>
                <View style={[styles.stepDot, isDone && styles.stepDotDone, isCurrent && styles.stepDotCurrent]}>
                  <Text style={styles.stepIcon}>{isDone ? step.icon : '○'}</Text>
                </View>
                <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>{step.label}</Text>
                {index < ORDER_STATUS_STEPS.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </View>
            );
          })}
        </View>

        {/* ETA */}
        {currentOrder?.estimatedDeliveryTime && (
          <View style={styles.eta}>
            <Text style={styles.etaLabel}>Estimated Arrival</Text>
            <Text style={styles.etaTime}>
              {new Date(currentOrder.estimatedDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  backBtn: {
    position: 'absolute', top: SPACING.md, left: SPACING.md,
    backgroundColor: COLORS.white, width: 40, height: 40,
    borderRadius: 20, justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.medium,
  },
  backBtnText: { fontSize: FONTS.sizes.xl, fontWeight: '700' },
  driverMarker: {
    backgroundColor: COLORS.primary, borderRadius: 24,
    padding: SPACING.sm, ...SHADOWS.medium,
  },
  driverMarkerText: { fontSize: 20 },
  destinationMarker: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: SPACING.sm, ...SHADOWS.small,
  },
  panel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.large,
    maxHeight: 320,
  },
  orderNumber: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text.primary, marginBottom: SPACING.sm },
  driverInfo: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.lightGray, padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md,
  },
  driverAvatar: { fontSize: 36 },
  driverName: { fontWeight: '700', fontSize: FONTS.sizes.md },
  driverRole: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  callBtn: {
    marginLeft: 'auto', backgroundColor: COLORS.primary,
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  stepsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  step: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center',
  },
  stepDotDone: { backgroundColor: '#E8F5E9' },
  stepDotCurrent: { backgroundColor: COLORS.primary },
  stepIcon: { fontSize: 16 },
  stepLabel: { fontSize: FONTS.sizes.xs, color: COLORS.gray, marginTop: 4, textAlign: 'center' },
  stepLabelDone: { color: COLORS.success, fontWeight: '600' },
  stepLine: { position: 'absolute', top: 18, left: '60%', right: '-60%', height: 2, backgroundColor: COLORS.border },
  stepLineDone: { backgroundColor: COLORS.success },
  eta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF5F2', padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
  },
  etaLabel: { fontSize: FONTS.sizes.md, color: COLORS.text.secondary },
  etaTime: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.primary },
});

export default OrderTrackingScreen;
