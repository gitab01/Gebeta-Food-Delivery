import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from './brand';
import { etb } from './api';
import { colors, radius, space, type, useStyles } from './theme';

/**
 * Charts built from Views, not a charting dependency: both apps run inside Expo Go and in
 * a browser from the same code, and every value here is a number the backend already
 * returned. Nothing is smoothed, extrapolated or drawn before it is earned.
 */

/** A column per day, scaled to the busiest one, with the best day named underneath. */
export function Bars({ data = [], height = 120, labelFor, bestLabel }) {
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const peak = Math.max(...data.map((d) => d.value), 1);
  const best = data.reduce((top, d) => (d.value > (top?.value ?? -1) ? d : top), null);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.bars, { height }]}>
        {width
          ? data.map((day) => (
              <View key={day.key} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(2, (day.value / peak) * (height - 2)),
                      backgroundColor: day.key === best?.key ? colors.accent : colors.line
                    }
                  ]}
                />
              </View>
            ))
          : null}
      </View>
      <View style={styles.barLabels}>
        {data.map((day) => (
          <Text key={day.key} style={[styles.barLabel, day.key === best?.key && styles.barLabelOn]}>
            {labelFor ? labelFor(day) : day.key}
          </Text>
        ))}
      </View>
      {best && best.value > 0 ? (
        <Text style={[type.small, { marginTop: space.sm }]}>{bestLabel || etb(best.value)}</Text>
      ) : null}
    </View>
  );
}

/** One stacked bar with a legend: how a total splits across its sources. */
export function Share({ slices = [], total }) {
  const styles = useStyles(makeStyles);
  const sum = total ?? slices.reduce((n, s) => n + s.value, 0);
  const visible = slices.filter((s) => s.value > 0);
  if (!sum || !visible.length) return null;
  return (
    <View>
      <View style={styles.share}>
        {visible.map((slice) => (
          <View key={slice.key} style={{ flex: slice.value / sum, backgroundColor: slice.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {visible.map((slice) => (
          <View key={slice.key} style={styles.legendRow}>
            <View style={[styles.legendSwatch, { backgroundColor: slice.color }]} />
            <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={type.body}>{Math.round((slice.value / sum) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A single number with the reason it moved, used across the top of the earnings screen. */
export function Metric({ label, value, tone = 'ink', icon }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.metric}>
      <View style={styles.metricHead}>
        {icon ? <Icon name={icon} size={14} color={colors.muted} /> : null}
        <Text style={type.eyebrow}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, tone === 'green' && { color: colors.green }, tone === 'accent' && { color: colors.accentInk }]}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
    bar: { width: '100%', borderRadius: radius.sm },
    barLabels: { flexDirection: 'row', gap: 6, marginTop: 6 },
    barLabel: { ...type.tiny, flex: 1, textAlign: 'center' },
    barLabelOn: { color: colors.ink, fontWeight: '700' },
    share: { flexDirection: 'row', height: 12, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.tint },
    legend: { marginTop: space.md, gap: space.sm },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    legendSwatch: { width: 10, height: 10, borderRadius: 5 },
    metric: { flex: 1, gap: 4 },
    metricHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metricValue: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.8, color: colors.ink }
  });
