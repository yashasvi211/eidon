import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';
import { Task } from './DetailPanel';

interface TimeTrackingProps {
  tasks: Task[];
  isSleeping: boolean;
  sleepStartTime: number | null;
}

const fmtSeconds = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtDuration = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  
  const hStr = h > 0 ? `${h}h ` : '';
  const mStr = m > 0 || h > 0 ? `${m}m ` : '';
  return `${hStr}${mStr}${s}s`;
};

const todayISO = () => new Date().toISOString().split('T')[0];

export default function TimeTracking({ tasks, isSleeping, sleepStartTime }: TimeTrackingProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [currentSleepDuration, setCurrentSleepDuration] = useState('');

  useEffect(() => {
    if (!isSleeping || !sleepStartTime) {
      setCurrentSleepDuration('');
      return;
    }
    const update = () => {
      setCurrentSleepDuration(fmtDuration(Date.now() - sleepStartTime));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isSleeping, sleepStartTime]);

  const today = todayISO();

  const todayEntries = useMemo(() => {
    const entries: {
      taskId: string;
      taskTitle: string;
      project: string;
      duration: number;
      start: number;
      end: number;
    }[] = [];

    tasks.forEach(task => {
      (task.sessions || []).forEach(sess => {
        const date = new Date(sess.start).toISOString().split('T')[0];
        if (date !== today) return;
        entries.push({
          taskId: task.id,
          taskTitle: task.title,
          project: task.project,
          duration: (sess.end - sess.start) / 1000,
          start: sess.start,
          end: sess.end
        });
      });
    });
    return entries.sort((a, b) => b.start - a.start);
  }, [tasks, today]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.ghBg }]} {...{ delaysContentTouches: false }}>

      {isSleeping && sleepStartTime && (
        <View style={[styles.sleepCard, { backgroundColor: 'rgba(88, 166, 255, 0.05)', borderColor: colors.ghBlue }]}>
          <Text style={[styles.sleepCardTitle, { color: colors.ghBlue }]}>Sleep Today</Text>
          <Text style={[styles.sleepDurationText, { color: colors.ghText }]}>
            {currentSleepDuration || '0s'}
          </Text>
          <Text style={[styles.sleepCardSub, { color: colors.ghMuted }]}>
            Started at {new Date(sleepStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      <View style={[styles.dateHeader, { borderBottomColor: colors.ghBorder }]}>
        <Text style={[styles.dateText, { color: colors.ghText }]}>
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {todayEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ color: colors.ghMuted, fontSize: 14 }}>No time tracked today.</Text>
        </View>
      ) : (
        <View style={styles.entriesList}>
          {todayEntries.map((entry, i) => (
            <View key={i} style={[styles.entryCard, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
              <View style={styles.entryInfo}>
                <Text style={[styles.entryTaskTitle, { color: colors.ghText }]}>{entry.taskTitle}</Text>
                <Text style={[styles.entryMeta, { color: colors.ghMuted }]}>
                  {entry.project} · {new Date(entry.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(entry.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={[styles.entryDuration, { color: colors.ghBlue }]}>
                {fmtSeconds(entry.duration)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sleepCard: {
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  sleepCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sleepDurationText: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sleepCardSub: {
    fontSize: 11,
    marginTop: 4,
  },
  dateHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  entriesList: {
    gap: 8,
    marginBottom: 30,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderRadius: 6,
  },
  entryInfo: {
    flex: 1,
    marginRight: 12,
  },
  entryTaskTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  entryMeta: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  entryDuration: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
  }
});
