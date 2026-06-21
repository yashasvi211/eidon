import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme, PanResponder } from 'react-native';
import { Colors } from '../constants/theme';
import { Task } from './DetailPanel';

interface ScheduledViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  showCompleted: boolean;
  onSwipeRight?: () => void;
}

const fmtDateISO = (d: Date) => {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function ScheduledView({ tasks, onSelectTask, showCompleted, onSwipeRight }: ScheduledViewProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Padding for previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Padding for next month
    const totalDays = 42; // 6 weeks
    const remainingDays = totalDays - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [viewDate]);

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handlePrev = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNext = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const handleToday = () => {
    const today = new Date();
    setViewDate(today);
    setSelectedDate(today);
  };

  const getTasksForDate = (date: Date) => {
    const iso = fmtDateISO(date);
    return tasks.filter(t => t.due === iso && (showCompleted || !t.done));
  };

  const selectedDateISO = fmtDateISO(selectedDate);
  const selectedDateTasks = tasks.filter(t => t.due === selectedDateISO && (showCompleted || !t.done));

  // Chunk calendar days into rows of 7
  const weeks = [];
  for (let i = 0; i < calendarData.length; i += 7) {
    weeks.push(calendarData.slice(i, i + 7));
  }

  // Sidebar swipe from non-calendar areas
  const emptyTouchStart = useRef(0);
  const handleEmptyTouchStart = (e: any) => { emptyTouchStart.current = e.nativeEvent.pageX; };
  const handleEmptyTouchEnd = (e: any) => {
    if (!onSwipeRight) return;
    const dx = e.nativeEvent.pageX - emptyTouchStart.current;
    if (dx > 60) onSwipeRight();
  };

  // Calendar layout bounds for restricting swipe area
  const calendarRef = useRef<View>(null);
  const calendarLayout = useRef({ y: 0, height: 0 });

  // Use refs to avoid stale closures in PanResponder
  const prevRef = useRef(handlePrev);
  const nextRef = useRef(handleNext);
  prevRef.current = handlePrev;
  nextRef.current = handleNext;

  // Swipe gesture to change months — only active over the calendar grid
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gs) => {
        const touchY = evt.nativeEvent.pageY;
        const { y, height } = calendarLayout.current;
        return (
          touchY >= y &&
          touchY <= y + height &&
          Math.abs(gs.dx) > 15 &&
          Math.abs(gs.dx) > Math.abs(gs.dy)
        );
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 60) {
          prevRef.current();
        } else if (gs.dx < -60) {
          nextRef.current();
        }
      },
    })
  ).current;

  const measureCalendar = () => {
    calendarRef.current?.measureInWindow((x, y, w, h) => {
      calendarLayout.current = { y, height: h };
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.ghBg }]} {...panResponder.panHandlers}>
      <View style={[styles.calHeader, { borderBottomColor: colors.ghBorder }]}
        onTouchStart={handleEmptyTouchStart}
        onTouchEnd={handleEmptyTouchEnd}
      >
        <TouchableOpacity style={[styles.btn, styles.btnArrow, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]} onPress={handlePrev}>
          <Text style={[styles.btnText, { color: colors.ghText }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.ghText }]}>
          {monthLabel}
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnArrow, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]} onPress={handleNext}>
          <Text style={[styles.btnText, { color: colors.ghText }]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.todayBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]} onPress={handleToday}>
          <Text style={[styles.btnText, { color: colors.ghText }]}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} {...{ delaysContentTouches: false }}>
        <View ref={calendarRef} style={styles.calendarContainer} onLayout={measureCalendar}>
          <View style={styles.weekdaysRow}>
            <View style={styles.weekNumberCol} />
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <Text key={d} style={[styles.weekdayText, { color: colors.ghMuted }]}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, weekIdx) => {
            const wn = getWeekNumber(week[4]?.date || week[0].date);
            return (
              <View key={weekIdx} style={styles.weekRow}>
                <View style={styles.weekNumberCol}>
                  <Text style={[styles.weekNumberText, { color: colors.ghMuted }]}>{wn}</Text>
                </View>
                {week.map((day, dayIdx) => {
                  const dayTasks = getTasksForDate(day.date);
                  const isToday = fmtDateISO(day.date) === fmtDateISO(new Date());
                  const isSelected = fmtDateISO(day.date) === selectedDateISO;

                  return (
                    <TouchableOpacity
                      key={dayIdx}
                      style={[
                        styles.dayCell,
                        {
                          backgroundColor: day.isCurrentMonth ? colors.ghSurface : 'rgba(22, 27, 34, 0.2)',
                          borderColor: isSelected ? colors.ghBlue : isToday ? colors.ghBorder2 : colors.ghBorder,
                          opacity: day.isCurrentMonth ? 1 : 0.4,
                        }
                      ]}
                      onPress={() => setSelectedDate(day.date)}
                    >
                      <Text style={[
                        styles.dayNumber,
                        {
                          color: isSelected ? colors.ghBlue : isToday ? colors.ghBlue : colors.ghText,
                          fontWeight: isToday || isSelected ? '700' : '400',
                        }
                      ]}>
                        {day.date.getDate()}
                      </Text>
                      
                      <View style={styles.dotsRow}>
                        {dayTasks.slice(0, 3).map((t) => (
                          <View
                            key={t.id}
                            style={[
                              styles.dot,
                              { backgroundColor: t.done ? colors.ghGreen : colors.ghBlue }
                            ]}
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <Text style={[styles.moreText, { color: colors.ghMuted }]}>+</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Tasks list for selected day */}
        <View style={[styles.tasksListSection, { borderTopColor: colors.ghBorder }]}
          onTouchStart={handleEmptyTouchStart}
          onTouchEnd={handleEmptyTouchEnd}
        >
          <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
            Tasks for {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>

          {selectedDateTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: colors.ghMuted, fontSize: 13 }}>No scheduled tasks for this day.</Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {selectedDateTasks.map(task => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskItemCard, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}
                  onPress={() => onSelectTask(task)}
                >
                  <View style={styles.taskCardMain}>
                    <Text style={[
                      styles.taskCardTitle,
                      { color: colors.ghText },
                      task.done && styles.lineThrough
                    ]}>
                      {task.title}
                    </Text>
                    <Text style={[styles.taskCardProject, { color: colors.ghMuted }]}>
                      {task.project}
                    </Text>
                  </View>
                  {task.est && (
                    <Text style={[styles.taskCardEst, { color: colors.ghBlue, borderColor: colors.ghBorder }]}>
                      {task.est}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  todayBtn: {
    marginLeft: 'auto',
  },
  btnArrow: {
    paddingHorizontal: 8,
    minWidth: 32,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
  },
  weekNumberCol: {
    width: 26,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNumberText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  calendarContainer: {
    padding: 12,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 6,
    padding: 4,
    justifyContent: 'space-between',
    marginHorizontal: 1,
  },
  dayNumber: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  moreText: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 6,
  },
  tasksListSection: {
    borderTopWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  taskList: {
    gap: 8,
  },
  taskItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 6,
  },
  taskCardMain: {
    flex: 1,
    marginRight: 12,
  },
  taskCardTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  taskCardProject: {
    fontSize: 10,
  },
  taskCardEst: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  lineThrough: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  }
});
