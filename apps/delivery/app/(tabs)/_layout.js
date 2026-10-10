import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '../../../shared/session';
import { colors } from '../../../shared/theme';

export default function TabsLayout() {
  const { user, checking } = useSession();
  if (checking) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'courier') return <Redirect href="/login" />;

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
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>▣</Text> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>¤</Text> }} />
      <Tabs.Screen name="account" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 17 }}>◔</Text> }} />
    </Tabs>
  );
}
