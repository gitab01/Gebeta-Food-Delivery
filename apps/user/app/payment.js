import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../shared/api';
import { Icon } from '../../shared/brand';
import { useI18n } from '../../shared/lang';
import { useSession } from '../../shared/session';
import { colors, radius, space, type, useStyles } from '../../shared/theme';
import { Button, Card, Chip, Choices, Empty, Field, Notice, Screen } from '../../shared/ui';

const BRANDS = ['card', 'telebirr', 'cbebir', 'cash'];
const GLYPH = { card: 'card', telebirr: 'phone', cbebir: 'bank', cash: 'money' };

/**
 * What is stored here is a choice, not credentials: brand, a nickname and the last four
 * digits. The backend refuses a body that carries anything card-number shaped, and this
 * screen never offers a field for one, so a full PAN cannot be typed by accident.
 */
export default function PaymentMethods() {
  const styles = useStyles(makeStyles);
  const { t } = useI18n();
  const { user, setUser } = useSession();
  const [form, setForm] = useState({ brand: 'card', label: '', last4: '', month: '', year: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const methods = user?.paymentMethods || [];
  const patch = (next) => setForm((current) => ({ ...current, ...next }));

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { brand: form.brand, label: form.label.trim() };
      if (form.brand === 'card') {
        body.last4 = form.last4.trim();
        body.expiryMonth = Number(form.month);
        body.expiryYear = Number(form.year);
      }
      const data = await api.addPaymentMethod(body);
      setUser(data.user);
      setForm({ brand: form.brand, label: '', last4: '', month: '', year: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (id) => {
    setError('');
    try {
      const data = await api.setDefaultPaymentMethod(id);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    setError('');
    try {
      const data = await api.removePaymentMethod(id);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Notice text={error} />

        {methods.length ? (
          <Card padded={false} style={styles.list}>
            {methods.map((method, index) => (
              <View key={method.id} style={[styles.item, index > 0 && styles.divider]}>
                <View style={styles.brand}>
                  <Icon name={GLYPH[method.brand] || 'card'} size={18} color={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{method.label || t(`pay.${method.brand}`)}</Text>
                  <Text style={type.small}>
                    {method.last4
                      ? `${t('pay.ending', { digits: method.last4 })}${
                          method.expiryMonth ? ` · ${t('pay.expires', { date: `${method.expiryMonth}/${method.expiryYear}` })}` : ''
                        }`
                      : t(`pay.${method.brand}`)}
                  </Text>
                </View>
                {method.isDefault ? (
                  <Chip tone="green" label={t('pay.default')} icon="check" />
                ) : (
                  <Button narrow variant="quiet" label={t('pay.setDefault')} onPress={() => setDefault(method.id)} />
                )}
                <Pressable hitSlop={8} onPress={() => remove(method.id)} accessibilityRole="button" accessibilityLabel={t('pay.remove')}>
                  <Icon name="trash" size={18} color={colors.faint} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Empty icon="card" title={t('pay.empty')} body={t('pay.emptyBody')} />
        )}

        <Card style={{ marginTop: space.lg }}>
          <Text style={type.eyebrow}>{t('pay.add')}</Text>
          <Choices
            style={{ marginTop: space.md }}
            value={form.brand}
            onChange={(brand) => patch({ brand })}
            options={BRANDS.map((brand) => ({ value: brand, label: t(`pay.${brand}`) }))}
          />

          <Field
            label={t('pay.label')}
            value={form.label}
            onChangeText={(label) => patch({ label })}
            placeholder={t('pay.labelHint')}
            style={{ marginTop: space.lg }}
          />

          {form.brand === 'card' ? (
            <View style={styles.rowFields}>
              <Field
                label={t('pay.last4')}
                value={form.last4}
                onChangeText={(last4) => patch({ last4: last4.replace(/\D/g, '').slice(0, 4) })}
                keyboardType="number-pad"
                placeholder="1234"
                style={{ flex: 1 }}
              />
              <Field
                label={t('pay.expiry')}
                value={`${form.month}/${form.year}`}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 6);
                  patch({ month: digits.slice(0, 2), year: digits.slice(2) });
                }}
                keyboardType="number-pad"
                placeholder="09/28"
                style={{ flex: 1 }}
              />
            </View>
          ) : null}

          <View style={styles.hint}>
            <Icon name="shield" size={16} color={colors.muted} />
            <Text style={[type.small, { flex: 1, marginLeft: space.sm }]}>{t('pay.hint')}</Text>
          </View>

          <Button label={t('pay.add')} icon="add" onPress={add} loading={busy} disabled={busy} style={{ marginTop: space.md }} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: { paddingVertical: space.lg, paddingBottom: space.xxl },
    list: { paddingVertical: space.xs },
    item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
    divider: { borderTopWidth: 1, borderTopColor: colors.line },
    brand: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      backgroundColor: colors.tint,
      alignItems: 'center',
      justifyContent: 'center'
    },
    rowFields: { flexDirection: 'row', gap: space.md },
    hint: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm }
  });
