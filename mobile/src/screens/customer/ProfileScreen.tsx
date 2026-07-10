import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const ProfileScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const menuItems = [
    { icon: '📋', label: 'My Orders', badge: null },
    { icon: '📍', label: 'Saved Addresses', badge: null },
    { icon: '💳', label: 'Payment Methods', badge: null },
    { icon: '🔔', label: 'Notifications', badge: null },
    { icon: '⭐', label: 'Rate Gebeta', badge: null },
    { icon: '❓', label: 'Help & Support', badge: null },
    { icon: '📃', label: 'Terms of Service', badge: null },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* User Header */}
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.phone && <Text style={styles.userPhone}>{user.phone}</Text>}
        </View>
        <View style={[styles.roleBadge, user?.role === 'driver' && styles.driverBadge]}>
          <Text style={styles.roleText}>{user?.role}</Text>
        </View>
      </View>

      {/* Stats (customer only) */}
      {user?.role === 'customer' && (
        <View style={styles.statsRow}>
          {[
            { label: 'Orders', value: '0' },
            { label: 'Favorites', value: '0' },
            { label: 'Reviews', value: '0' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: FONTS.sizes.xxl, fontWeight: '800' },
  userName: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text.primary },
  userEmail: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  userPhone: { fontSize: FONTS.sizes.sm, color: COLORS.text.secondary },
  roleBadge: {
    marginLeft: 'auto', backgroundColor: '#E3F2FD',
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  driverBadge: { backgroundColor: '#E8F5E9' },
  roleText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.info, textTransform: 'capitalize' },
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  statValue: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.text.secondary, marginTop: 2 },
  menu: { backgroundColor: COLORS.white, marginTop: SPACING.md, ...SHADOWS.small },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.md,
  },
  menuIcon: { fontSize: 20, width: 28 },
  menuLabel: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text.primary, fontWeight: '500' },
  menuArrow: { color: COLORS.gray, fontSize: FONTS.sizes.xl, fontWeight: '300' },
  logoutBtn: {
    margin: SPACING.lg, padding: SPACING.md,
    backgroundColor: '#FFEBEE', borderRadius: BORDER_RADIUS.md, alignItems: 'center',
  },
  logoutText: { color: COLORS.error, fontWeight: '700', fontSize: FONTS.sizes.md },
});

export default ProfileScreen;
