import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  useColorScheme, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tracker, TrackerEntry, TrackerFrequency } from '../types/tracking';
import { Colors } from '../constants/theme';
import { api } from '../services/api';

interface TrackerDetailProps {
  tracker: Tracker;
  onBack: () => void;
  onUpdate: (updatedTracker: Tracker) => void;
  onDelete: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCurrentPeriodKey(frequency: TrackerFrequency): string {
  const now = new Date();
  if (frequency === 'monthly') return now.toISOString().substring(0, 7);
  if (frequency === 'daily') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const tmp = new Date(now);
  const dayNr = (now.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - dayNr + 3);
  const firstThu = new Date(tmp.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tmp.getTime() - firstThu.getTime()) / 86400000 - 3 + (firstThu.getDay() + 6) % 7) / 7);
  return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function navigatePeriod(period: string, frequency: TrackerFrequency, direction: -1 | 1): string {
  if (frequency === 'daily') {
    const d = new Date(period + 'T00:00:00');
    d.setDate(d.getDate() + direction);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (frequency === 'monthly') {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  // weekly: "2026-W30"
  const [yr, wk] = period.split('-W').map(Number);
  let newWk = wk + direction;
  let newYr = yr;
  if (newWk < 1) { newYr--; newWk = 52; }
  if (newWk > 52) { newYr++; newWk = 1; }
  return `${newYr}-W${String(newWk).padStart(2, '0')}`;
}

function formatPeriodLabel(period: string, frequency: TrackerFrequency): string {
  if (frequency === 'daily') {
    const d = new Date(period + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (frequency === 'monthly') {
    const [y, m] = period.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  // Weekly
  const [yr, wk] = period.split('-W').map(Number);
  // Find date of Monday of that week
  const jan4 = new Date(yr, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + (wk - 1) * 7);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const mStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const sStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${mStr} – ${sStr}`;
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

// ─── Bar Chart ──────────────────────────────────────────────────────────────

function BarChart({ tracker, colors }: { tracker: Tracker; colors: any }) {
  const COUNT = tracker.frequency === 'daily' ? 14 : 8;
  const sorted = useMemo(() =>
    [...tracker.entries].sort((a, b) => a.period.localeCompare(b.period)),
    [tracker.entries]
  );
  const recent = sorted.slice(-COUNT);
  const maxVal = recent.reduce((m, e) => Math.max(m, e.value), 0);

  // Build slots (fill gaps with null)
  const slots: { period: string; entry: TrackerEntry | null }[] = [];
  for (let i = 0; i < COUNT; i++) {
    const offset = COUNT - recent.length;
    if (i < offset) {
      // Walk backward from the first real entry to fill gap slots
      const firstRealPeriod = recent[0]?.period ?? getCurrentPeriodKey(tracker.frequency);
      let gapPeriod = firstRealPeriod;
      const stepsBack = offset - i;
      for (let s = 0; s < stepsBack; s++) {
        gapPeriod = navigatePeriod(gapPeriod, tracker.frequency, -1);
      }
      slots.push({ period: gapPeriod, entry: null });
    } else {
      slots.push({ period: recent[i - offset].period, entry: recent[i - offset] });
    }
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4, paddingBottom: 28, paddingHorizontal: 4 }}>
        {slots.map((slot, idx) => {
          const pct = maxVal > 0 && slot.entry ? (slot.entry.value / maxVal) * 72 : 0;
          const label = formatPeriodLabel(slot.period, tracker.frequency);
          const shortLabel = tracker.frequency === 'daily'
            ? label.replace('Today', 'Now').slice(0, 6)
            : tracker.frequency === 'monthly'
            ? label.slice(0, 3)
            : `W${slot.period.split('-W')[1] ?? ''}`;
          return (
            <View key={idx} style={{ alignItems: 'center', width: 28 }}>
              <View
                style={{
                  width: 20, height: Math.max(slot.entry ? 6 : 3, pct), borderRadius: 4,
                  backgroundColor: slot.entry ? tracker.color : hexToRgba(tracker.color, 0.15),
                  marginBottom: 4,
                }}
              />
              <Text style={{ color: colors.ghMuted, fontSize: 8, textAlign: 'center' }} numberOfLines={1}>
                {shortLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TrackerDetail({ tracker, onBack, onUpdate, onDelete }: TrackerDetailProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'add'>('overview');
  const [entryPeriod, setEntryPeriod] = useState(getCurrentPeriodKey(tracker.frequency));
  const [inputHours, setInputHours] = useState('');
  const [inputMins, setInputMins] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);

  const existingForPeriod = tracker.entries.find(e => e.period === entryPeriod);

  const stats = useMemo(() => {
    const now = new Date();
    const currentPeriod = getCurrentPeriodKey(tracker.frequency);
    const currentEntry = tracker.entries.find(e => e.period === currentPeriod);
    const currentValue = currentEntry?.value ?? 0;

    const allValues = tracker.entries.map(e => e.value);
    const total = allValues.reduce((a, b) => a + b, 0);
    const best = allValues.length > 0 ? Math.max(...allValues) : 0;
    const avg = allValues.length > 0 ? total / allValues.length : 0;

    // This week total (daily trackers)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (now.getDay() + 6) % 7);
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekTotal = tracker.frequency === 'daily'
      ? tracker.entries.filter(e => new Date(e.period + 'T00:00:00') >= weekStart).reduce((s, e) => s + e.value, 0)
      : 0;

    // This month total
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthTotal = tracker.frequency === 'daily'
      ? tracker.entries.filter(e => e.period.startsWith(monthPrefix)).reduce((s, e) => s + e.value, 0)
      : tracker.frequency === 'monthly'
      ? (tracker.entries.find(e => e.period === monthPrefix)?.value ?? 0)
      : 0;

    const bestPeriod = tracker.entries.find(e => e.value === best);

    return { currentValue, total, best, avg, thisWeekTotal, thisMonthTotal, bestPeriod };
  }, [tracker]);

  const handleSave = async () => {
    let finalValue = 0;
    if (tracker.valueType === 'duration') {
      finalValue = (parseInt(inputHours || '0', 10) * 3600) + (parseInt(inputMins || '0', 10) * 60);
    } else if (tracker.valueType === 'decimal') {
      finalValue = parseFloat(inputVal || '0');
    } else {
      finalValue = parseInt(inputVal || '0', 10);
    }
    if (isNaN(finalValue) || finalValue <= 0) {
      Alert.alert('Invalid value', 'Please enter a value greater than 0.');
      return;
    }

    setSaving(true);
    const newEntry: TrackerEntry = {
      id: existingForPeriod?.id ?? `e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      period: entryPeriod,
      value: finalValue,
      recordedAt: Date.now(),
    };
    await api.upsertTrackerEntry(tracker.id, newEntry);
    const updatedEntries = existingForPeriod
      ? tracker.entries.map(e => e.id === existingForPeriod.id ? newEntry : e)
      : [...tracker.entries, newEntry];
    onUpdate({ ...tracker, entries: updatedEntries });
    setInputHours(''); setInputMins(''); setInputVal('');
    setSaving(false);
    setActiveTab('overview');
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert('Delete Entry', 'Remove this entry from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api.deleteTrackerEntry(tracker.id, entryId);
          onUpdate({ ...tracker, entries: tracker.entries.filter(e => e.id !== entryId) });
        },
      },
    ]);
  };

  const handleDeleteTracker = () => {
    Alert.alert('Delete Tracker', `Delete "${tracker.name}" and all its history? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  // Pre-fill inputs when existing entry detected
  const onTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'add') {
      const existing = tracker.entries.find(e => e.period === entryPeriod);
      if (existing) {
        if (tracker.valueType === 'duration') {
          setInputHours(String(Math.floor(existing.value / 3600)));
          setInputMins(String(Math.floor((existing.value % 3600) / 60)));
        } else {
          setInputVal(String(existing.value));
        }
      }
    }
  };

  const onPeriodNav = (dir: -1 | 1) => {
    const next = navigatePeriod(entryPeriod, tracker.frequency, dir);
    setEntryPeriod(next);
    const existing = tracker.entries.find(e => e.period === next);
    if (existing) {
      if (tracker.valueType === 'duration') {
        setInputHours(String(Math.floor(existing.value / 3600)));
        setInputMins(String(Math.floor((existing.value % 3600) / 60)));
      } else {
        setInputVal(String(existing.value));
      }
    } else {
      setInputHours(''); setInputMins(''); setInputVal('');
    }
  };

  const tabs: { key: typeof activeTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'bar-chart-2' },
    { key: 'history', label: 'History', icon: 'list' },
    { key: 'add', label: 'Add Entry', icon: 'plus-circle' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.ghBg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.ghBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={20} color={colors.ghText} />
          <Text style={[styles.backText, { color: colors.ghText }]}>Trackers</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerEmoji}>{tracker.emoji}</Text>
          <Text style={[styles.headerTitle, { color: colors.ghText }]} numberOfLines={1}>{tracker.name}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.ghSurface, borderBottomColor: colors.ghBorder }]}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && { borderBottomColor: tracker.color, borderBottomWidth: 2 }]}
              onPress={() => onTabChange(tab.key)}
            >
              <Feather name={tab.icon as any} size={14} color={active ? tracker.color : colors.ghMuted} style={{ marginBottom: 2 }} />
              <Text style={[styles.tabText, { color: active ? tracker.color : colors.ghMuted }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <View>
            {/* Hero current value */}
            <View style={[styles.heroCard, { backgroundColor: hexToRgba(tracker.color, 0.08), borderColor: hexToRgba(tracker.color, 0.2) }]}>
              <Text style={[styles.heroLabel, { color: colors.ghMuted }]}>
                {tracker.frequency === 'daily' ? 'TODAY' : tracker.frequency === 'weekly' ? 'THIS WEEK' : 'THIS MONTH'}
              </Text>
              <Text style={[styles.heroValue, { color: tracker.color }]}>
                {stats.currentValue > 0 ? formatValue(stats.currentValue, tracker.valueType, tracker.unit) : '—'}
              </Text>
              <Text style={[styles.heroSub, { color: colors.ghMuted }]}>
                {stats.currentValue === 0 ? 'No entry recorded yet' : `Best ever: ${formatValue(stats.best, tracker.valueType, tracker.unit)}`}
              </Text>
            </View>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              {[
                { label: 'BEST', value: formatValue(stats.best, tracker.valueType, tracker.unit) },
                { label: 'AVERAGE', value: formatValue(Math.round(stats.avg), tracker.valueType, tracker.unit) },
                ...(tracker.frequency === 'daily' ? [
                  { label: 'THIS WEEK', value: formatValue(stats.thisWeekTotal, tracker.valueType, tracker.unit) },
                  { label: 'THIS MONTH', value: formatValue(stats.thisMonthTotal, tracker.valueType, tracker.unit) },
                ] : []),
                { label: 'TOTAL ENTRIES', value: String(tracker.entries.length) },
              ].map((stat, idx) => (
                <View key={idx} style={[styles.statCard, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
                  <Text style={[styles.statLabel, { color: colors.ghMuted }]}>{stat.label}</Text>
                  <Text style={[styles.statValue, { color: colors.ghText }]}>{stat.value}</Text>
                </View>
              ))}
            </View>

            {/* Bar chart */}
            {tracker.entries.length > 0 && (
              <View style={[styles.chartCard, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
                <Text style={[styles.chartTitle, { color: colors.ghMuted }]}>
                  LAST {tracker.frequency === 'daily' ? '14 DAYS' : tracker.frequency === 'weekly' ? '8 WEEKS' : '8 MONTHS'}
                </Text>
                <BarChart tracker={tracker} colors={colors} />
              </View>
            )}

            {/* Delete tracker */}
            <TouchableOpacity
              style={[styles.deleteTrackerBtn, { borderColor: colors.ghRed || '#f85149' }]}
              onPress={handleDeleteTracker}
            >
              <Feather name="trash-2" size={14} color={colors.ghRed || '#f85149'} />
              <Text style={[styles.deleteTrackerText, { color: colors.ghRed || '#f85149' }]}>Delete this tracker</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 'history' && (
          <View>
            {tracker.entries.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Feather name="clock" size={32} color={colors.ghMuted} />
                <Text style={[styles.emptyHistoryText, { color: colors.ghMuted }]}>No entries yet</Text>
                <TouchableOpacity onPress={() => onTabChange('add')}>
                  <Text style={{ color: tracker.color, fontWeight: '600', marginTop: 8 }}>Add your first entry →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              [...tracker.entries]
                .sort((a, b) => b.period.localeCompare(a.period))
                .map(entry => (
                  <View key={entry.id} style={[styles.historyRow, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
                    <View style={[styles.historyAccent, { backgroundColor: tracker.color }]} />
                    <View style={styles.historyRowContent}>
                      <Text style={[styles.historyPeriod, { color: colors.ghMuted }]}>
                        {formatPeriodLabel(entry.period, tracker.frequency)}
                      </Text>
                      <Text style={[styles.historyValue, { color: tracker.color }]}>
                        {formatValue(entry.value, tracker.valueType, tracker.unit)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.historyDeleteBtn, { backgroundColor: 'rgba(248,81,73,0.08)' }]}
                      onPress={() => handleDeleteEntry(entry.id)}
                    >
                      <Feather name="trash-2" size={14} color={colors.ghRed || '#f85149'} />
                    </TouchableOpacity>
                  </View>
                ))
            )}
          </View>
        )}

        {/* ── ADD ENTRY ── */}
        {activeTab === 'add' && (
          <View>
            {/* Period selector */}
            <View style={[styles.periodSelector, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
              <TouchableOpacity style={styles.periodNavBtn} onPress={() => onPeriodNav(-1)}>
                <Feather name="chevron-left" size={20} color={colors.ghText} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[styles.periodSelectorLabel, { color: colors.ghMuted }]}>PERIOD</Text>
                <Text style={[styles.periodSelectorValue, { color: colors.ghText }]}>
                  {formatPeriodLabel(entryPeriod, tracker.frequency)}
                </Text>
              </View>
              <TouchableOpacity style={styles.periodNavBtn} onPress={() => onPeriodNav(1)}>
                <Feather name="chevron-right" size={20} color={colors.ghText} />
              </TouchableOpacity>
            </View>

            {existingForPeriod && (
              <View style={[styles.existingBanner, { backgroundColor: hexToRgba(tracker.color, 0.1), borderColor: hexToRgba(tracker.color, 0.25) }]}>
                <Feather name="edit-2" size={13} color={tracker.color} />
                <Text style={[styles.existingBannerText, { color: tracker.color }]}>
                  Existing entry: {formatValue(existingForPeriod.value, tracker.valueType, tracker.unit)} — saving will update it
                </Text>
              </View>
            )}

            {/* Value input */}
            <View style={[styles.inputCard, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
              <Text style={[styles.inputCardLabel, { color: colors.ghMuted }]}>
                {tracker.valueType === 'duration' ? 'DURATION' : `VALUE (${tracker.unit.toUpperCase()})`}
              </Text>

              {tracker.valueType === 'duration' ? (
                <View style={styles.durationRow}>
                  <View style={styles.durationField}>
                    <TextInput
                      style={[styles.durationInput, { color: tracker.color, borderColor: hexToRgba(tracker.color, 0.3), backgroundColor: hexToRgba(tracker.color, 0.06) }]}
                      value={inputHours}
                      onChangeText={setInputHours}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.ghMuted}
                      maxLength={3}
                    />
                    <Text style={[styles.durationUnit, { color: colors.ghMuted }]}>hours</Text>
                  </View>
                  <Text style={[styles.durationColon, { color: colors.ghMuted }]}>:</Text>
                  <View style={styles.durationField}>
                    <TextInput
                      style={[styles.durationInput, { color: tracker.color, borderColor: hexToRgba(tracker.color, 0.3), backgroundColor: hexToRgba(tracker.color, 0.06) }]}
                      value={inputMins}
                      onChangeText={setInputMins}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.ghMuted}
                      maxLength={2}
                    />
                    <Text style={[styles.durationUnit, { color: colors.ghMuted }]}>min</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.singleInputRow}>
                  <TextInput
                    style={[styles.singleInput, { color: tracker.color, borderColor: hexToRgba(tracker.color, 0.3), backgroundColor: hexToRgba(tracker.color, 0.06) }]}
                    value={inputVal}
                    onChangeText={setInputVal}
                    keyboardType={tracker.valueType === 'decimal' ? 'decimal-pad' : 'number-pad'}
                    placeholder={tracker.valueType === 'decimal' ? '0.0' : '0'}
                    placeholderTextColor={colors.ghMuted}
                  />
                  <Text style={[styles.singleInputUnit, { color: colors.ghMuted }]}>{tracker.unit}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tracker.color, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : existingForPeriod ? 'Update Entry' : 'Save Entry'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 14, fontWeight: '600' },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 2, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  content: { padding: 16 },

  heroCard: {
    borderRadius: 16, borderWidth: 1, padding: 28,
    alignItems: 'center', marginBottom: 16,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  heroValue: { fontSize: 52, fontWeight: '800', fontFamily: 'monospace', marginBottom: 6 },
  heroSub: { fontSize: 13 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flexBasis: '47%', flexGrow: 1, padding: 14,
    borderRadius: 12, borderWidth: 1,
  },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },

  chartCard: {
    borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16,
  },
  chartTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 12 },

  deleteTrackerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12, marginTop: 8,
  },
  deleteTrackerText: { fontSize: 13, fontWeight: '600' },

  emptyHistory: { alignItems: 'center', paddingTop: 60 },
  emptyHistoryText: { fontSize: 16, fontWeight: '600', marginTop: 12 },

  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: 'hidden',
  },
  historyAccent: { width: 4, alignSelf: 'stretch' },
  historyRowContent: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  historyPeriod: { fontSize: 12, marginBottom: 3 },
  historyValue: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  historyDeleteBtn: { padding: 16, marginRight: 4, borderRadius: 8 },

  periodSelector: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden',
  },
  periodNavBtn: { padding: 16 },
  periodSelectorLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  periodSelectorValue: { fontSize: 16, fontWeight: '700' },

  existingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  existingBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },

  inputCard: { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  inputCardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 16 },

  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  durationField: { flex: 1, alignItems: 'center' },
  durationInput: {
    width: '100%', fontSize: 40, fontWeight: '800', fontFamily: 'monospace',
    textAlign: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  durationUnit: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  durationColon: { fontSize: 32, fontWeight: '300', marginTop: -20 },

  singleInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  singleInput: {
    flex: 1, fontSize: 40, fontWeight: '800', fontFamily: 'monospace',
    textAlign: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  singleInputUnit: { fontSize: 16, fontWeight: '600', minWidth: 50 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
