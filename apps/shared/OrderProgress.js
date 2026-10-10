import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, statusColor, type } from './theme';
import { ORDER, RAIL, TERMINAL, stageIndex } from './status';

/**
 * The order state machine, drawn from the server's own statusHistory. A client
 * can only ever show a step the backend actually recorded.
 */
export function OrderProgress({ order }) {
  const reached = new Set((order?.statusHistory || []).map((e) => e.status));
  const current = order?.status;
  const ended = TERMINAL.includes(current);
  const failed = current === 'REJECTED' || current === 'CANCELLED';
  const steps = failed ? [...ORDER.slice(0, Math.max(1, stageIndex(current === 'REJECTED' ? 'PAID' : 'PLACED'))), current] : ORDER;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {steps.map((status, index) => {
          const done = reached.has(status) && status !== current;
          const active = status === current;
          const tone = statusColor(status);
          const fill = done || active ? tone.fg : colors.line;
          return (
            <View key={status} style={[styles.step, { flex: 1 }]}>
              <View style={styles.railWrap}>
                <View style={[styles.node, { backgroundColor: fill }]} />
                {index < steps.length - 1 ? <View style={styles.rail} /> : null}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: active ? colors.ink : done ? colors.muted : colors.faint, fontWeight: active ? '700' : '500' }
                ]}
                numberOfLines={1}
              >
                {RAIL[status] || status}
              </Text>
            </View>
          );
        })}
      </View>
      {order?.eta?.reason ? (
        <View style={styles.eta}>
          <Text style={[styles.etaMinutes, { color: statusColor(current).fg }]} numberOfLines={1}>
            {ended ? 'Closed' : `${order.eta.minutes ?? '—'} min`}
          </Text>
          <Text style={[type.small, { flex: 1 }]}>{order.eta.reason}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  track: { flexDirection: 'row' },
  step: { gap: 6 },
  railWrap: { flexDirection: 'row', alignItems: 'center' },
  node: { width: 12, height: 12, borderRadius: 6 },
  rail: { flex: 1, height: 2, backgroundColor: colors.line, marginRight: 4 },
  label: { fontSize: 11, lineHeight: 14, paddingRight: 4 },
  eta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.tint,
    borderRadius: radius.md,
    padding: space.md
  },
  etaMinutes: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, flexShrink: 0 },
});
