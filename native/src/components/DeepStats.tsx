import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';
import { Task } from './DetailPanel';

interface DeepStatsProps {
  tasks: Task[];
}

const fmtSeconds = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const parseEstimate = (est?: string) => {
  if (!est) return 0;
  let total = 0;
  const hMatch = est.match(/(\d+\.?\d*)h/);
  const mMatch = est.match(/(\d+)m/);
  if (hMatch) total += parseFloat(hMatch[1]) * 3600;
  if (mMatch) total += parseInt(mMatch[1]) * 60;
  return total;
};

const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const getWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}, ${start.getFullYear()}`;
};

export default function DeepStats({ tasks }: DeepStatsProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(new Date());
  const [projectFilter, setProjectFilter] = useState<string>('All');

  const handlePrevWeek = () => {
    setSelectedWeekDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setSelectedWeekDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleThisWeek = () => {
    setSelectedWeekDate(new Date());
  };

  const weekRange = useMemo(() => {
    const d = new Date(selectedWeekDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [selectedWeekDate]);

  const weekLabel = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekRange.start.toLocaleDateString("en-US", options)} - ${weekRange.end.toLocaleDateString("en-US", options)}, ${weekRange.start.getFullYear()}`;
  }, [weekRange]);

  const projects = useMemo(() => {
    const pSet = new Set<string>();
    tasks.forEach((t) => {
      if (t.project && t.project !== 'Inbox') pSet.add(t.project);
    });
    return ['All', 'Inbox', ...Array.from(pSet).sort()];
  }, [tasks]);

  const stats = useMemo(() => {
    const filteredTasks =
      projectFilter === 'All'
        ? tasks
        : tasks.filter((t) => t.project === projectFilter);

    let totalAllocated = 0;
    let totalWorked = 0;
    let totalWindows = 0;
    let taskBreakdown: {
      title: string;
      worked: number;
      alloc: number;
      windows: number;
      project: string;
      dates: string[];
    }[] = [];
    let groupedTime: { [key: string]: { worked: number; windows: number; date: number; label: string } } = {};

    const current = new Date(weekRange.start);
    for (let i = 0; i < 7; i++) {
      const key = current.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      groupedTime[key] = { worked: 0, windows: 0, date: current.getTime(), label: key };
      current.setDate(current.getDate() + 1);
    }

    filteredTasks.forEach((task) => {
      const alloc = parseEstimate(task.est);
      const sessions = (task.sessions || []).filter(
        (s) => s.start >= weekRange.start.getTime() && s.start <= weekRange.end.getTime()
      );
      const worked = sessions.reduce((acc, s) => acc + (s.end - s.start) / 1000, 0);

      if (worked === 0) return;

      const windows = sessions.length;
      totalAllocated += alloc;
      totalWorked += worked;
      totalWindows += windows;

      const uniqueDates = Array.from(
        new Set(
          sessions.map((s) =>
            new Date(s.start).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          )
        )
      );

      taskBreakdown.push({
        title: task.title,
        worked,
        alloc,
        windows,
        project: task.project,
        dates: uniqueDates,
      });

      sessions.forEach((sess) => {
        const date = new Date(sess.start);
        const key = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

        if (groupedTime[key]) {
          groupedTime[key].worked += (sess.end - sess.start) / 1000;
          groupedTime[key].windows += 1;
        }
      });
    });

    const timeline = Object.entries(groupedTime)
      .sort((a, b) => a[1].date - b[1].date)
      .map(([key, data]) => ({ key, ...data }));

    return {
      totalAllocated,
      totalWorked,
      totalWindows,
      taskBreakdown: taskBreakdown.sort((a, b) => b.worked - a.worked),
      timeline,
    };
  }, [tasks, weekRange, projectFilter]);

  // Find max worked time in timeline for bar height ratios
  const maxWorked = useMemo(() => {
    if (stats.timeline.length === 0) return 1;
    return Math.max(...stats.timeline.map((t) => t.worked), 1);
  }, [stats.timeline]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.ghBg }]} {...{ delaysContentTouches: false }}>
      {/* Weekly Navigation Controls */}
      <View style={styles.navRow}>
        <View style={styles.navControls}>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}
            onPress={handlePrevWeek}
          >
            <Text style={[styles.navBtnText, { color: colors.ghText }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.weekLabel, { color: colors.ghText }]} numberOfLines={1}>
            {weekLabel}
          </Text>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}
            onPress={handleNextWeek}
          >
            <Text style={[styles.navBtnText, { color: colors.ghText }]}>›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.todayBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}
          onPress={handleThisWeek}
        >
          <Text style={[styles.todayBtnText, { color: colors.ghText }]}>This Week</Text>
        </TouchableOpacity>
      </View>

      {/* Project Filter Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} {...{ delaysContentTouches: false }}>
        {projects.map((proj) => (
          <TouchableOpacity
            key={proj}
            style={[
              styles.filterChip,
              projectFilter === proj && { backgroundColor: colors.ghBlue, borderColor: colors.ghBlue },
              { borderColor: colors.ghBorder }
            ]}
            onPress={() => setProjectFilter(proj)}
          >
            <Text style={[styles.filterChipText, { color: projectFilter === proj ? '#fff' : colors.ghText }]}>
              {proj}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats Cards */}
      <View style={styles.cardsRow}>
        <View style={[styles.card, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.ghMuted }]}>ESTIMATED</Text>
          <Text style={[styles.cardValue, { color: colors.ghBlue }]}>{fmtSeconds(stats.totalAllocated)}</Text>
          <Text style={[styles.cardSub, { color: colors.ghMuted }]}>Total allocated</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.ghMuted }]}>WORKED</Text>
          <Text style={[styles.cardValue, { color: colors.ghGreen }]}>{fmtSeconds(stats.totalWorked)}</Text>
          <Text style={[styles.cardSub, { color: colors.ghMuted }]}>Total focus time</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
          <Text style={[styles.cardTitle, { color: colors.ghMuted }]}>SESSIONS</Text>
          <Text style={[styles.cardValue, { color: colors.ghPurple }]}>{stats.totalWindows}</Text>
          <Text style={[styles.cardSub, { color: colors.ghMuted }]}>Focus windows</Text>
        </View>
      </View>

      {/* Focus Timeline Bar Chart */}
      <View style={[styles.section, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
        <Text style={[styles.sectionHeader, { color: colors.ghText }]}>Focus Timeline</Text>
        {stats.timeline.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.ghMuted }]}>No time logs for current filter.</Text>
        ) : (
          <View style={styles.chartContainer}>
            {stats.timeline.map((item) => (
              <View key={item.key} style={styles.chartRow}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.chartRowLabel,
                    {
                      color: colors.ghText,
                      width: 85
                    }
                  ]}
                >
                  {item.label}
                </Text>
                <View style={styles.chartBarWrapper}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        backgroundColor: colors.ghBlue,
                        width: `${Math.max((item.worked / maxWorked) * 100, 3)}%`,
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.chartRowValue, { color: colors.ghMuted }]}>
                  {fmtSeconds(item.worked)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Task Breakdown list */}
      <View style={[styles.section, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder, marginBottom: 30 }]}>
        <Text style={[styles.sectionHeader, { color: colors.ghText }]}>Task Breakdown</Text>
        {stats.taskBreakdown.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.ghMuted }]}>No tasks found.</Text>
        ) : (
          <View style={styles.breakdownList}>
            {stats.taskBreakdown.map((item, idx) => {
              const ratio = item.alloc > 0 ? Math.min((item.worked / item.alloc) * 100, 100) : 0;
              return (
                <View key={idx} style={[styles.breakdownItem, { borderBottomColor: colors.ghBorder }]}>
                  <View style={styles.breakdownItemHeader}>
                    <Text style={[styles.breakdownItemTitle, { color: colors.ghText }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.breakdownItemValues, { color: colors.ghMuted }]}>
                      {fmtSeconds(item.worked)} / {item.alloc > 0 ? fmtSeconds(item.alloc) : '—'}
                    </Text>
                  </View>
                  {item.alloc > 0 && (
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            backgroundColor: ratio >= 100 ? colors.ghGreen : colors.ghBlue,
                            width: `${ratio}%`,
                          }
                        ]}
                      />
                    </View>
                  )}
                  <View style={styles.breakdownMeta}>
                    <Text style={[styles.breakdownMetaText, { color: colors.ghMuted }]} numberOfLines={2}>
                      {item.project} · {item.windows} sessions
                      {item.dates.length > 0 && ` · On: ${item.dates.join(', ')}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  todayBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 9,
    textAlign: 'center',
  },
  section: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  chartContainer: {
    gap: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartRowLabel: {
    fontSize: 12,
    width: 65,
  },
  chartBarWrapper: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  chartRowValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    width: 50,
    textAlign: 'right',
  },
  breakdownList: {
    gap: 12,
  },
  breakdownItem: {
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  breakdownItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownItemTitle: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  breakdownItemValues: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  breakdownMeta: {
    flexDirection: 'row',
  },
  breakdownMetaText: {
    fontSize: 10,
  }
});
