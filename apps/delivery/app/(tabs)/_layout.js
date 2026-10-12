import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useSession } from '../../../shared/session';
import { colors, useTheme } from '../../../shared/theme';
import { useI18n } from '../../../shared/lang';
import { Icon } from '../../../shared/brand';
import { isWeb } from '../../../shared/ui';

const TABS = [
  { name: 'jobs', icon: 'jobs', key: 'tab.jobs' },
  { name: 'earnings', icon: 'earnings', key: 'tab.earnings' },
  { name: 'account', icon: 'profile', key: 'tab.profile' }
];

export default function TabsLayout() {
  useTheme();
  const { t } = useI18n();
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
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          ...(isWeb && { height: 62, paddingBottom: 12 })
        },
        sceneStyle: { backgroundColor: colors.paper }
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            tabBarIcon: ({ color }) => <Icon name={tab.icon} size={22} color={color} />
          }}
        />
      ))}
    </Tabs>
  );
}
