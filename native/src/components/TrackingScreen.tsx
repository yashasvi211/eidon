import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tracker, TrackerEntry } from '../types/tracking';
import { Colors } from '../constants/theme';

interface TrackingScreenProps {
  trackers: Tracker[];
  onSelectTracker: (tracker: Tracker) => void;
  onAddTracker: () => void;
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCurrentPeriodKey(frequency: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date();
  if (frequency === 'monthly') return now.toISOString().substring(0, 7);
  if (frequency === 'daily') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // weekly ISO
  const tmp = new Date(now);
  const dayNr = (now.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - dayNr + 3);
  const firstThu = new Date(tmp.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tmp.getTime() - firstThu.getTime()) / 86400000 - 3 + (firstThu.getDay() + 6) % 7) / 7);
  return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function formatValue(value: number, type: 'count' | 'duration' | 'decimal', unit: string): string {
  if (type === 'duration') {
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
  if (type === 'decimal') return `${value.toFixed(1)} ${unit}`;
  return `${value.toLocaleString()} ${unit}`;
}

function getStats(tracker: Tracker) {
  const currentPeriod = getCurrentPeriodKey(tracker.frequency);
  const currentEntry = tracker.entries.find(e => e.period === currentPeriod);
  const currentValue = currentEntry?.value ?? 0;

  const now = new Date();
  // This week
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (now.getDay() + 6) % 7);
  const thisWeekEntries = tracker.frequency === 'daily'
    ? tracker.entries.filter(e => {
      const d = new Date(e.period + 'T00:00:00');
      return d >= weekStart;
    })
    : [];
  const thisWeekTotal = thisWeekEntries.reduce((s, e) => s + e.value, 0);

  // This month
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthEntries = tracker.frequency === 'daily'
    ? tracker.entries.filter(e => e.period.startsWith(monthPrefix))
    : tracker.frequency === 'monthly'
    ? tracker.entries.filter(e => e.period === monthPrefix)
    : [];
  const thisMonthTotal = thisMonthEntries.reduce((s, e) => s + e.value, 0);

  const allValues = tracker.entries.map(e => e.value);
  const best = allValues.length > 0 ? Math.max(...allValues) : 0;
  const avg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;

  return { currentValue, thisWeekTotal, thisMonthTotal, best, avg, entryCount: tracker.entries.length };
}

function MiniSparkline({ tracker }: { tracker: Tracker }) {
  const maxBars = tracker.frequency === 'daily' ? 10 : 6;
  const sorted = [...tracker.entries].sort((a, b) => a.period.localeCompare(b.period));
  const recent = sorted.slice(-maxBars);
  const maxVal = recent.reduce((m, e) => Math.max(m, e.value), 0);

  const bars: { value: number; hasData: boolean }[] = [];
  for (let i = 0; i < maxBars; i++) {
    const offset = maxBars - recent.length;
    if (i < offset) {
      bars.push({ value: 0, hasData: false });
    } else {
      bars.push({ value: recent[i - offset].value, hasData: true });
    }
  }

  return (
    <View style={spark.container}>
      {bars.map((bar, idx) => {
        const heightPct = maxVal > 0 ? (bar.value / maxVal) * 100 : 0;
        return (
          <View key={idx} style={spark.barWrapper}>
            <View
              style={[
                spark.bar,
                {
                  height: `${Math.max(bar.hasData ? 10 : 4, heightPct)}%`,
                  backgroundColor: bar.hasData ? tracker.color : 'transparent',
                  borderColor: bar.hasData ? tracker.color : 'rgba(139,148,158,0.2)',
                  borderWidth: bar.hasData ? 0 : 1,
                  opacity: bar.hasData ? (bar.value === 0 ? 0.3 : 1) : 1,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const spark = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 44, gap: 3 },
  barWrapper: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
});

export default function TrackingScreen({ trackers, onSelectTracker, onAddTracker }: TrackingScreenProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.ghBg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {trackers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
              <Feather name="bar-chart-2" size={36} color={colors.ghMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.ghText }]}>No trackers yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.ghMuted }]}>
              Create a tracker to start measuring what matters — study time, workouts, books, anything.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.ghBlue }]}
              onPress={onAddTracker}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Create First Tracker</Text>
            </TouchableOpacity>
          </View>
        ) : (
          trackers.map(tracker => {
            const { currentValue, thisWeekTotal, thisMonthTotal, avg, entryCount } = getStats(tracker);
            const freqLabel = tracker.frequency === 'daily' ? 'Today' : tracker.frequency === 'weekly' ? 'This week' : 'This month';

            const secondaryLabel = tracker.frequency === 'daily'
              ? `This week: ${formatValue(thisWeekTotal, tracker.valueType, tracker.unit)}`
              : tracker.frequency === 'weekly'
              ? `This month: ${formatValue(thisMonthTotal, tracker.valueType, tracker.unit)}`
              : `${entryCount} month${entryCount !== 1 ? 's' : ''} recorded`;

            const avgLabel = `Avg: ${formatValue(Math.round(avg), tracker.valueType, tracker.unit)}`;

            return (
              <TouchableOpacity
                key={tracker.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.ghSurface,
                    borderColor: colors.ghBorder,
                    borderLeftColor: tracker.color,
                  },
                ]}
                onPress={() => onSelectTracker(tracker)}
                activeOpacity={0.82}
              >
                {/* Tinted background */}
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: hexToRgba(tracker.color, 0.05), borderRadius: 14 },
                  ]}
                />

                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardEmoji}>{tracker.emoji}</Text>
                    <Text style={[styles.cardName, { color: colors.ghText }]}>{tracker.name}</Text>
                  </View>
                  <View style={[styles.freqBadge, { backgroundColor: hexToRgba(tracker.color, 0.18) }]}>
                    <Text style={[styles.freqBadgeText, { color: tracker.color }]}>
                      {tracker.frequency.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Main body: value + sparkline */}
                <View style={styles.cardBody}>
                  <View style={styles.cardValueBlock}>
                    <Text style={[styles.cardPeriodLabel, { color: colors.ghMuted }]}>{freqLabel}</Text>
                    <Text style={[styles.cardValue, { color: tracker.color }]}>
                      {currentValue > 0 ? formatValue(currentValue, tracker.valueType, tracker.unit) : '—'}
                    </Text>
                    <View style={styles.cardSecondaryRow}>
                      <Text style={[styles.cardSecondary, { color: colors.ghMuted }]}>{secondaryLabel}</Text>
                      <Text style={[styles.cardSecondary, { color: colors.ghMuted }]}>  ·  {avgLabel}</Text>
                    </View>
                  </View>

                  <MiniSparkline tracker={tracker} />
                </View>

                {/* Footer: entry count + chevron */}
                <View style={[styles.cardFooter, { borderTopColor: hexToRgba(tracker.color, 0.15) }]}>
                  <Text style={[styles.cardFooterText, { color: colors.ghMuted }]}>
                    {entryCount} entr{entryCount !== 1 ? 'ies' : 'y'} logged
                  </Text>
                  <Feather name="chevron-right" size={14} color={colors.ghMuted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.ghBlue }]}
        onPress={onAddTracker}
        activeOpacity={0.88}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  card: {
    borderRadius: 14, borderWidth: 1, borderLeftWidth: 4,
    marginBottom: 14, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardEmoji: { fontSize: 22 },
  cardName: { fontSize: 16, fontWeight: '700' },
  freqBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  freqBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  cardBody: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  cardValueBlock: { flex: 1, marginRight: 12 },
  cardPeriodLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  cardValue: { fontSize: 30, fontWeight: '800', fontFamily: 'monospace', marginBottom: 4 },
  cardSecondaryRow: { flexDirection: 'row', flexWrap: 'wrap' },
  cardSecondary: { fontSize: 12 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1,
  },
  cardFooterText: { fontSize: 12 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
});
