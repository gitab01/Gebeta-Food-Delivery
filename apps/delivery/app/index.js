import React from 'react';
import { Redirect } from 'expo-router';
import { useI18n } from '../../shared/lang';
import { useSession } from '../../shared/session';
import { Loading } from '../../shared/ui';

export default function Index() {
  const { t } = useI18n();
  const { user, checking } = useSession();
  if (checking) return <Loading label={t('auth.checkingSession')} />;
  return <Redirect href={user ? '/(tabs)/jobs' : '/login'} />;
}
