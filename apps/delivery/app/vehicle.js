import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../shared/api';
import { Icon } from '../../shared/brand';
import { useI18n } from '../../shared/lang';
import { colors, radius, space, type, useStyles } from '../../shared/theme';
import { Button, Card, Choices, Field, Loading, Notice, Screen } from '../../shared/ui';

const TYPES = [
  { value: 'foot', icon: 'walk', labelKey: 'vehicle.foot' },
  { value: 'bicycle', icon: 'bicycle', labelKey: 'vehicle.bicycle' },
  { value: 'motorbike', icon: 'motorbike', labelKey: 'vehicle.motorbike' },
  { value: 'car', icon: 'car', labelKey: 'vehicle.car' }
];

const isoDay = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

/**
 * What a customer and a kitchen are shown when they decide whether to trust this courier
 * with food: the vehicle, the plate, and whether the insurance on file still reads as
 * current. The server normalises the plate and rejects an unreadable date.
 */
export default function Vehicle() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const [form, setForm] = useState({ type: 'motorbike', licencePlate: '', insuranceProvider: '', insuranceExpiresAt: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.courierMe();
      setForm({
        type: data.vehicle?.type || 'motorbike',
        licencePlate: data.vehicle?.licencePlate || '',
        insuranceProvider: data.vehicle?.insuranceProvider || '',
        insuranceExpiresAt: isoDay(data.vehicle?.insuranceExpiresAt)
      });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (next) => {
    setForm((current) => ({ ...current, ...next }));
    setSaved('');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.courierVehicle({
        type: form.type,
        licencePlate: form.licencePlate,
        insuranceProvider: form.insuranceProvider,
        insuranceExpiresAt: form.insuranceExpiresAt || undefined
      });
      setForm({
        type: data.vehicle.type,
        licencePlate: data.vehicle.licencePlate || '',
        insuranceProvider: data.vehicle.insuranceProvider || '',
        insuranceExpiresAt: isoDay(data.vehicle.insuranceExpiresAt)
      });
      setSaved(t('vehicle.saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label={t('common.loading')} />;

  const chosen = TYPES.find((option) => option.value === form.type) || TYPES[2];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Notice text={error} />
        <Notice tone="success" text={saved} />

        <Card>
          <Text style={type.eyebrow}>{t('vehicle.title')}</Text>
          <Choices
            style={{ marginTop: space.md }}
            value={form.type}
            onChange={(type_) => patch({ type: type_ })}
            options={TYPES.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          />

          <View style={styles.preview}>
            <View style={styles.previewIcon}>
              <Icon name={chosen.icon} size={20} color={colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{t(chosen.labelKey)}</Text>
              <Text style={type.small}>{form.licencePlate || t('vehicle.none')}</Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Field
            label={t('vehicle.plate')}
            value={form.licencePlate}
            onChangeText={(licencePlate) => patch({ licencePlate: licencePlate.toUpperCase().slice(0, 12) })}
            placeholder={t('vehicle.plateHint')}
          />
          <Field
            label={t('vehicle.insurer')}
            value={form.insuranceProvider}
            onChangeText={(insuranceProvider) => patch({ insuranceProvider })}
            placeholder="Nyala Insurance"
          />
          <Field
            label={t('vehicle.validUntil')}
            value={form.insuranceExpiresAt}
            onChangeText={(insuranceExpiresAt) => patch({ insuranceExpiresAt: insuranceExpiresAt.slice(0, 10) })}
            placeholder="2027-03-31"
          />
          <Button label={t('vehicle.save')} icon="check" onPress={save} loading={busy} disabled={busy} style={{ marginTop: space.sm }} />
        </Card>

        <Text style={[type.small, { marginTop: space.lg, textAlign: 'center' }]}>{t('vehicle.footNote')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      marginTop: space.lg,
      paddingTop: space.lg,
      borderTopWidth: 1,
      borderTopColor: colors.line
    },
    previewIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.tint,
      alignItems: 'center',
      justifyContent: 'center'
    }
  });
