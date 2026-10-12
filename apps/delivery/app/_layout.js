import React from 'react';
import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '../../shared/session';
import { AppProviders } from '../../shared/providers';
import { colors, useTheme } from '../../shared/theme';
import { useI18n } from '../../shared/lang';
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

function RootNavigator() {
  useTheme();
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.paper },
        headerBackTitleVisible: false
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="job/[id]" options={{ title: t('job.title') }} />
      <Stack.Screen name="vehicle" options={{ title: t('vehicle.title') }} />
      <Stack.Screen name="settings" options={{ title: t('set.title') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <AppProviders>
        <PositionReporter />
        <RootNavigator />
      </AppProviders>
    </SessionProvider>
  );
}
