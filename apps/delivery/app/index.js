import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../../shared/session';
import { Loading } from '../../shared/ui';

export default function Index() {
  const { user, checking } = useSession();
  if (checking) return <Loading label="Checking your session" />;
  return <Redirect href={user ? '/(tabs)/jobs' : '/login'} />;
}
