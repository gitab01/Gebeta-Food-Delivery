import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from './brand';
import { useI18n } from './lang';
import { colors, radius, space, type, useStyles } from './theme';
import { Card, Screen } from './ui';

/**
 * The whole policy in four paragraphs, each one a fact about this system rather than
 * boilerplate: what the API stores, what it refuses to accept, which fields cross over
 * to a kitchen or a courier, and how a session is bounded. Only `en` carries the long
 * sentences - the other languages fall back until a native review writes them.
 */
const SECTIONS = [
  { icon: 'card', title: 'privacy.store', body: 'privacy.storeBody' },
  { icon: 'shield', title: 'privacy.never', body: 'privacy.neverBody' },
  { icon: 'users', title: 'privacy.sharing', body: 'privacy.sharingBody' },
  { icon: 'lock', title: 'privacy.protection', body: 'privacy.protectionBody' }
];

export function AppPrivacy() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={type.small}>{t('privacy.intro')}</Text>

        {SECTIONS.map((section) => (
          <Card key={section.title} style={{ marginTop: space.md }}>
            <View style={styles.head}>
              <View style={styles.headIcon}>
                <Icon name={section.icon} size={17} color={colors.muted} />
              </View>
              <Text style={type.h3}>{t(section.title)}</Text>
            </View>
            <Text style={[type.body, styles.body]}>{t(section.body)}</Text>
          </Card>
        ))}

        <Text style={[type.tiny, { marginTop: space.lg, textAlign: 'center' }]}>{t('privacy.foot')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    headIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      backgroundColor: colors.tint,
      alignItems: 'center',
      justifyContent: 'center'
    },
    body: { marginTop: space.md }
  });
