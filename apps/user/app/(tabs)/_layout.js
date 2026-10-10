import React from 'react';
import { Tabs } from 'expo-router';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '../../../shared/session';
import { colors } from '../../../shared/theme';

export default function TabsLayout() {
  const { user, checking } = useSession();
  if (checking) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.paper }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Near you', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>◍</Text> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>▤</Text> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>◔</Text> }} />
    </Tabs>
  );
}
