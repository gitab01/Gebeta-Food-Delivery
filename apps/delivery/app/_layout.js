import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../../shared/session';
import { colors } from '../../shared/theme';
import { usePositionReporting } from '../lib/location';

/**
 * Position reporting lives above the tabs so it survives navigation: a courier who
 * opens the earnings screen must not disappear from the customer's tracker.
 */
function PositionReporter() {
  const { user } = useSession();
  usePositionReporting(user?.role === 'courier');
  return null;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <PositionReporter />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
      </Stack>
    </SessionProvider>
  );
}
