import React from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../shared/session';
import { Loading } from '../../shared/ui';

export default function Index() {
  const { user, checking } = useSession();
  if (checking) return <Loading label="Starting Gebeta" />;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
