import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { api } from './api';
import { getPref, PREF, setPref } from './prefs';
import { useI18n } from './lang';
import { space, type, useStyles } from './theme';
import { mapsReady, setMapsOn, useMapsOn } from './map/config';
import { Card, Notice, Preferences, Screen, Setting, Toggle } from './ui';

/**
 * The settings body both apps mount as their own /settings screen. Every control here
 * writes through to the same preference store the providers read, so there is nothing to
 * save and nothing to drift. The map switch can only do what the build allows: without a
 * compiled-in key it still shows the schematic, and the screen says so instead of lying.
 */
export function AppSettings() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const router = useRouter();
  const [notify, setNotify] = useState(() => getPref(PREF.notify) !== 'off');
  const [meta, setMeta] = useState(null);
  const mapOn = useMapsOn();
  const keyPresent = mapsReady();

  useEffect(() => {
    let alive = true;
    api
      .meta()
      .then((data) => alive && setMeta(data))
      .catch(() => alive && setMeta({}));
    return () => {
      alive = false;
    };
  }, []);

  const support = meta?.supportContact;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Preferences />
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Text style={[type.eyebrow, { marginBottom: space.xs }]}>{t('set.notifications')}</Text>
          <Toggle
            icon="bell"
            label={t('set.notificationsOn')}
            foot={t('set.foot')}
            value={notify}
            onValueChange={(value) => {
              setNotify(value);
              setPref(PREF.notify, value ? 'on' : 'off');
            }}
          />
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Text style={[type.eyebrow, { marginBottom: space.xs }]}>{t('set.map')}</Text>
          <Toggle
            icon="map"
            label={t('set.mapOn')}
            foot={t('set.mapOffLabel')}
            value={mapOn}
            onValueChange={setMapsOn}
          />
          {!keyPresent ? (
            <Notice tone="success" text={t('set.mapNoKey')} />
          ) : (
            <Setting icon="shield" label={t('set.mapState', { state: t('set.mapEnabled') })} />
          )}
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Text style={[type.eyebrow, { marginBottom: space.xs }]}>{t('set.about')}</Text>
          <Text style={type.small}>{t('set.aboutBody')}</Text>
        </Card>

        <Card style={{ marginTop: space.md, paddingVertical: space.xs }}>
          <Setting icon="phone" label={t('set.contact')} value={support} />
          {meta && !support ? <Text style={[type.tiny, styles.hint]}>{t('set.noContactSet')}</Text> : null}
          <Setting icon="settings" label={t('set.version')} value={Constants.expoConfig?.version || '1.0.0'} />
          <Setting icon="lock" label={t('privacy.title')} onPress={() => router.push('/privacy')} />
        </Card>

        <Text style={[type.tiny, { marginTop: space.lg, textAlign: 'center' }]}>{t('set.dataFoot')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    hint: { paddingLeft: space.xxl + space.md, paddingBottom: space.md }
  });
