import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setDriverAvailability, updateDriverLocationSocket } from '../../services/socket';
import api from '../../services/api';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const DriverHomeScreen = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const locationInterval = useRef<any>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location access is needed to go online.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value);
    setDriverAvailability(value);

    await api.patch('/drivers/status', { isOnline: value, isAvailable: value }).catch(console.error);

    if (value) {
      // Start broadcasting location every 5 seconds
      locationInterval.current = setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({});
        const newLoc = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setLocation(newLoc);
        updateDriverLocationSocket(newLoc.lat, newLoc.lng);
      }, 5000);
    } else {
      clearInterval(locationInterval.current);
    }
  };

  useEffect(() => {
    return () => clearInterval(locationInterval.current);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          showsMyLocationButton
          initialRegion={{
            latitude: location?.lat || 9.0192,
            longitude: location?.lng || 38.7525,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        />
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusTitle}>
              {isOnline ? '🟢 You are Online' : '🔴 You are Offline'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isOnline ? 'Waiting for orders...' : 'Go online to start receiving orders'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: COLORS.lightGray, true: COLORS.success + '60' }}
            thumbColor={isOnline ? COLORS.success : COLORS.gray}
          />
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: '📦', label: 'Today', value: '0 orders' },
            { icon: '💰', label: 'Earnings', value: '0 ETB' },
            { icon: '⭐', label: 'Rating', value: '5.0' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Pending Order Alert */}
      {pendingOrder && (
        <View style={styles.orderAlert}>
          <Text style={styles.orderAlertTitle}>🔔 New Order!</Text>
          <Text style={styles.orderAlertText}>{pendingOrder.restaurant?.name}</Text>
          <Text style={styles.orderAlertAmount}>{pendingOrder.pricing?.total?.toFixed(2)} ETB</Text>
          <View style={styles.orderAlertActions}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => setPendingOrder(null)}
            >
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => {
                // Accept logic via socket
                setPendingOrder(null);
              }}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  statusCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.large,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: SPACING.md,
  },
  statusTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text.primary },
  statusSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text.primary },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.text.secondary },
  orderAlert: {
    position: 'absolute', top: SPACING.xl, left: SPACING.lg, right: SPACING.lg,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, ...SHADOWS.large, borderLeftWidth: 4, borderLeftColor: COLORS.primary,
  },
  orderAlertTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.primary },
  orderAlertText: { fontSize: FONTS.sizes.md, color: COLORS.text.primary, marginTop: SPACING.xs },
  orderAlertAmount: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.success, marginTop: SPACING.xs },
  orderAlertActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  rejectBtn: {
    flex: 1, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.error, alignItems: 'center',
  },
  rejectBtnText: { color: COLORS.error, fontWeight: '700' },
  acceptBtn: {
    flex: 2, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.success, alignItems: 'center',
  },
  acceptBtnText: { color: COLORS.white, fontWeight: '700' },
});

export default DriverHomeScreen;
