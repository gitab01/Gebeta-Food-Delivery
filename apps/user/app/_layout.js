import React from 'react';
import { Stack } from 'expo-router';
import { CartProvider } from '../../shared/cart';
import { SessionProvider } from '../../shared/session';
import { AppProviders } from '../../shared/providers';
import { colors, useTheme } from '../../shared/theme';
import { useI18n } from '../../shared/lang';

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
      <Stack.Screen name="restaurant/[id]" options={{ title: t('menu.title') }} />
      <Stack.Screen name="checkout" options={{ title: t('cart.title') }} />
      <Stack.Screen name="track/[id]" options={{ title: t('track.title') }} />
      <Stack.Screen name="payment" options={{ title: t('pay.title') }} />
      <Stack.Screen name="settings" options={{ title: t('set.title') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <AppProviders>
        <CartProvider>
          <RootNavigator />
        </CartProvider>
      </AppProviders>
    </SessionProvider>
  );
}
