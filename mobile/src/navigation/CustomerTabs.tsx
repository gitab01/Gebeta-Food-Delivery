import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/customer/HomeScreen';
import RestaurantScreen from '../screens/customer/RestaurantScreen';
import CartScreen from '../screens/customer/CartScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import OrderTrackingScreen from '../screens/customer/OrderTrackingScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import { COLORS } from '../constants/theme';
import { useSelector } from 'react-redux';
import { selectCartItemCount } from '../store/slices/cartSlice';
import { RootState } from '../store';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Restaurant" component={RestaurantScreen} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} />
    <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
  </Stack.Navigator>
);

const CustomerTabs = () => {
  const cartCount = useSelector((state: RootState) => selectCartItemCount(state));

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          paddingBottom: 8,
          height: 60,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            HomeTab: focused ? 'home' : 'home-outline',
            CartTab: focused ? 'cart' : 'cart-outline',
            OrdersTab: focused ? 'receipt' : 'receipt-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'help'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          tabBarLabel: 'Cart',
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
        }}
      />
      <Tab.Screen name="OrdersTab" component={OrdersScreen} options={{ tabBarLabel: 'Orders' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
};

export default CustomerTabs;
