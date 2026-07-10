import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import DriverDeliveriesScreen from '../screens/driver/DriverDeliveriesScreen';
import DriverEarningsScreen from '../screens/driver/DriverEarningsScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import { COLORS } from '../constants/theme';

const Tab = createBottomTabNavigator();

const DriverTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.gray,
      tabBarStyle: { backgroundColor: COLORS.white, borderTopColor: COLORS.border, height: 60 },
      tabBarIcon: ({ focused, color, size }) => {
        const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
          DriverHome: focused ? 'bicycle' : 'bicycle-outline',
          Deliveries: focused ? 'list' : 'list-outline',
          Earnings: focused ? 'wallet' : 'wallet-outline',
          DriverProfile: focused ? 'person' : 'person-outline',
        };
        return <Ionicons name={icons[route.name] || 'help'} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="DriverHome" component={DriverHomeScreen} options={{ tabBarLabel: 'Dashboard' }} />
    <Tab.Screen name="Deliveries" component={DriverDeliveriesScreen} options={{ tabBarLabel: 'Deliveries' }} />
    <Tab.Screen name="Earnings" component={DriverEarningsScreen} options={{ tabBarLabel: 'Earnings' }} />
    <Tab.Screen name="DriverProfile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
  </Tab.Navigator>
);

export default DriverTabs;
