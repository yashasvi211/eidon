import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { Task } from './DetailPanel';

interface ScheduledViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  showCompleted: boolean;
  onSwipeRight?: () => void;
}

type ViewMode = 'day' | 'week' | 'month';

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

const HOUR_HEIGHT = 60; 
const VISUALIZER_HEIGHT = 370;

export default function ScheduledView({ tasks, onSelectTask, showCompleted, onSwipeRight }: ScheduledViewProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();
  
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    setViewDate(selectedDate);
  }, [viewMode]);

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    const totalDays = 42; 
    const remainingDays = totalDays - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    return days;
  }, [viewDate]);

  const weekData = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const date = selectedDate.getDate();
    const dayOfWeek = selectedDate.getDay();
    
    const startOfWeek = new Date(year, month, date - dayOfWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push({
        date: new Date(year, month, startOfWeek.getDate() + i),
        isCurrentMonth: true 
      });
    }
    return days;
  }, [selectedDate]);

  const headerLabel = useMemo(() => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    } else if (viewMode === 'week') {
      return `Week ${getWeekNumber(selectedDate)}`;
    } else {
      const y = String(viewDate.getFullYear()).slice(-2);
      const m = viewDate.toLocaleDateString('en-US', { month: 'long' });
      return `${m} '${y}`;
    }
  }, [viewMode, viewDate, selectedDate]);

  const handlePrev = () => {
    if (viewMode === 'month') {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 7));
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 7));
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1));
    }
  };

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
  const selectedDateTasks = getTasksForDate(selectedDate);
  const selectedWeekTasks = weekData.flatMap(day => getTasksForDate(day.date));

  // Determine bottom list tasks & title
  const bottomTasks = viewMode === 'week' ? selectedWeekTasks : selectedDateTasks;
  const bottomTitle = viewMode === 'week'
    ? `TASKS FOR WEEK ${getWeekNumber(selectedDate)}`
    : `TASKS FOR ${selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}`;

  const weeks = [];
  for (let i = 0; i < calendarData.length; i += 7) {
    weeks.push(calendarData.slice(i, i + 7));
  }

  const emptyTouchStart = useRef(0);
  const handleEmptyTouchStart = (e: any) => { emptyTouchStart.current = e.nativeEvent.pageX; };
  const handleEmptyTouchEnd = (e: any) => {
    if (!onSwipeRight) return;
    const dx = e.nativeEvent.pageX - emptyTouchStart.current;
    if (dx > 60) onSwipeRight();
  };

  // ──── RENDER VISUALIZERS (FIXED HEIGHT) ────

  const renderMonthGridDays = (daysToRender: any[]) => {
    return (
      <View style={styles.weekRow}>
        <View style={styles.weekNumberCol}>
          <Text style={[styles.weekNumberText, { color: colors.ghMuted }]}>
            {getWeekNumber(daysToRender[0].date)}
          </Text>
        </View>
        {daysToRender.map((day, dayIdx) => {
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
  };

  const renderMonthVisualizer = () => {
    return (
      <View style={styles.calendarContainer}>
        <View style={styles.weekdaysRow}>
          <View style={styles.weekNumberCol} />
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <Text key={d} style={[styles.weekdayText, { color: colors.ghMuted }]}>{d}</Text>
          ))}
        </View>
        {weeks.map((week, weekIdx) => renderMonthGridDays(week))}
      </View>
    );
  };

  const renderWeekVisualizer = () => {
    return (
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingVertical: 8 }}>
          {weekData.map((day, idx) => {
            const dayTasks = getTasksForDate(day.date);
            const isToday = fmtDateISO(day.date) === fmtDateISO(new Date());
            const isSelected = fmtDateISO(day.date) === selectedDateISO;

            return (
              <TouchableOpacity 
                key={idx} 
                style={[
                  styles.weekListRow, 
                  { borderBottomColor: colors.ghBorder },
                  isSelected && { backgroundColor: 'rgba(255,255,255,0.02)' }
                ]}
                onPress={() => setSelectedDate(day.date)}
              >
                <View style={styles.weekListDayLabel}>
                  <Text style={[styles.weekListDayName, { color: isToday ? colors.ghBlue : colors.ghMuted }]}>
                    {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.weekListDayNumber, { color: isToday || isSelected ? colors.ghBlue : colors.ghText, fontWeight: isToday || isSelected ? 'bold' : 'normal' }]}>
                    {day.date.getDate()}
                  </Text>
                </View>

                <View style={styles.weekListTasks}>
                  {dayTasks.length === 0 ? (
                    <View style={styles.weekListEmpty}>
                      <Text style={{ color: colors.ghMuted, fontSize: 11, fontStyle: 'italic' }}>No tasks</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekListTasksContent}>
                      {dayTasks.map(task => (
                        <View
                          key={task.id}
                          style={[styles.weekListTaskCard, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}
                        >
                          <Text style={[styles.weekListTaskTitle, { color: colors.ghText }, task.done && styles.lineThrough]} numberOfLines={1}>
                            {task.title}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderDayVisualizer = () => {
    const timelineBlocks: { id: string, task: Task, startHour: number, durationHours: number, type: 'scheduled' | 'session' }[] = [];
    
    selectedDateTasks.forEach(task => {
      let hasSessionsToday = false;
      if (task.sessions && task.sessions.length > 0) {
        task.sessions.forEach(session => {
          const sDate = new Date(session.start);
          if (fmtDateISO(sDate) === selectedDateISO) {
            hasSessionsToday = true;
            const h = sDate.getHours();
            const m = sDate.getMinutes();
            const startHour = h + m / 60;
            
            let durationHours = 1;
            if (session.end) {
               durationHours = (session.end - session.start) / 3600000;
            } else if (session.durationMinutes) {
               durationHours = session.durationMinutes / 60;
            }
            durationHours = Math.max(durationHours, 0.5); 
            
            timelineBlocks.push({
              id: `${task.id}_${session.id}`,
              task,
              startHour,
              durationHours,
              type: 'session'
            });
          }
        });
      }
      
      if (!hasSessionsToday && task.dueTime) {
         const [h, m] = task.dueTime.split(':').map(Number);
         const startHour = h + m / 60;
         
         let durationHours = 1;
         if (task.est) {
            const estMatch = task.est.match(/(\d+)h/);
            const estMinMatch = task.est.match(/(\d+)m/);
            let totalH = 0;
            if (estMatch) totalH += parseInt(estMatch[1], 10);
            if (estMinMatch) totalH += parseInt(estMinMatch[1], 10) / 60;
            if (totalH > 0) durationHours = totalH;
         }
         
         timelineBlocks.push({
            id: `${task.id}_due`,
            task,
            startHour,
            durationHours,
            type: 'scheduled'
         });
      }
    });

    const allDayTasks = selectedDateTasks.filter(task => {
       if (task.dueTime) return false;
       if (task.sessions && task.sessions.some(s => fmtDateISO(new Date(s.start)) === selectedDateISO)) return false;
       return true;
    });

    return (
      <View style={{ flex: 1 }}>
        {allDayTasks.length > 0 && (
          <View style={[styles.allDaySection, { borderBottomColor: colors.ghBorder }]}>
            <Text style={[styles.allDayLabel, { color: colors.ghMuted }]}>All Day</Text>
            <View style={styles.allDayList}>
              {allDayTasks.map(task => (
                <View
                  key={task.id}
                  style={[styles.allDayTask, { backgroundColor: colors.ghBlue + '20', borderColor: colors.ghBlue + '40' }]}
                >
                  <Text style={[styles.allDayTaskText, { color: colors.ghBlue }, task.done && styles.lineThrough]} numberOfLines={1}>
                    {task.title}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.timelineContainer}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={i} style={[styles.hourRow, { height: HOUR_HEIGHT, borderBottomColor: colors.ghBorder }]}>
                <Text style={[styles.hourText, { color: colors.ghMuted }]}>
                  {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                </Text>
                <View style={[styles.hourLine, { backgroundColor: colors.ghBorder }]} />
              </View>
            ))}

            {timelineBlocks.map(block => {
              const topOffset = block.startHour * HOUR_HEIGHT;
              const height = Math.max(block.durationHours * HOUR_HEIGHT, 30);

              return (
                <View
                  key={block.id}
                  style={[
                    styles.timelineTask,
                    {
                      top: topOffset,
                      height,
                      backgroundColor: block.type === 'session' ? colors.ghGreen : colors.ghBlue,
                      borderColor: colors.ghBg, 
                    }
                  ]}
                >
                  <Text style={[styles.timelineTaskTitle, block.task.done && styles.lineThrough]} numberOfLines={1}>
                    {block.task.title}
                  </Text>
                  {height >= 40 && (
                    <Text style={styles.timelineTaskTime} numberOfLines={1}>
                      {block.type === 'session' ? 'Session Logged' : (block.task.dueTime || 'Scheduled')}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.ghBg }]}>
      {/* Top Header / Nav */}
      <View style={[styles.calHeader, { borderBottomColor: colors.ghBorder, justifyContent: 'space-between' }]}
        onTouchStart={handleEmptyTouchStart}
        onTouchEnd={handleEmptyTouchEnd}
      >
        {/* Date Navigation (Left) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
          <TouchableOpacity style={[styles.btn, styles.btnArrow, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, marginRight: 6 }]} onPress={handlePrev}>
            <Text style={[styles.btnText, { color: colors.ghText }]}>‹</Text>
          </TouchableOpacity>
          
          <Text style={[styles.monthLabel, { color: colors.ghText, minWidth: 110, textAlign: 'center' }]} numberOfLines={1}>
            {headerLabel}
          </Text>

          <TouchableOpacity style={[styles.btn, styles.btnArrow, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, marginLeft: 6 }]} onPress={handleNext}>
            <Text style={[styles.btnText, { color: colors.ghText }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Compact View Mode Toggle (Right) */}
        <View style={[styles.segmentControl, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, marginHorizontal: 0, marginVertical: 0 }]}>
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.segmentBtn,
                { paddingHorizontal: 0, width: 36, flex: undefined, minHeight: 28, paddingVertical: 4 },
                viewMode === mode && { backgroundColor: colors.ghBg, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }
              ]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[
                styles.segmentText,
                { color: viewMode === mode ? colors.ghText : colors.ghMuted, fontWeight: viewMode === mode ? '700' : '500', fontSize: 11 }
              ]}>
                {mode.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Fixed Height Visualizer */}
      <View style={{ height: VISUALIZER_HEIGHT }}>
        {viewMode === 'day' && renderDayVisualizer()}
        {viewMode === 'week' && renderWeekVisualizer()}
        {viewMode === 'month' && renderMonthVisualizer()}
      </View>

      {/* Bottom Task List */}
      <ScrollView 
        style={[styles.scrollArea, { borderTopWidth: 1, borderTopColor: colors.ghBorder }]} 
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <View style={styles.tasksListSection}>
          <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>
            {bottomTitle}
          </Text>

          {bottomTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: colors.ghMuted, fontSize: 13 }}>No scheduled tasks.</Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {bottomTasks.map(task => (
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
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {task.dueTime && (
                      <Text style={[styles.taskCardEst, { color: colors.ghText, borderColor: 'transparent', backgroundColor: colors.ghSurface2 }]}>
                        {task.dueTime}
                      </Text>
                    )}
                    {task.est && (
                      <Text style={[styles.taskCardEst, { color: colors.ghBlue, borderColor: colors.ghBorder }]}>
                        {task.est}
                      </Text>
                    )}
                  </View>
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
  dateLabelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: '10%',
  },
  segmentControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 13,
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
    position: 'absolute',
    right: 16,
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
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
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
  },
  allDaySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  allDayLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  allDayList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allDayTask: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  allDayTaskText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineContainer: {
    position: 'relative',
    height: 24 * HOUR_HEIGHT,
    marginVertical: 10,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  hourText: {
    width: 45,
    fontSize: 11,
    textAlign: 'right',
    marginRight: 10,
    marginTop: -7,
  },
  hourLine: {
    flex: 1,
    height: 1,
  },
  timelineTask: {
    position: 'absolute',
    left: 65,
    right: 15,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  timelineTaskTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  timelineTaskTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 2,
  },
  weekListRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 65,
  },
  weekListDayLabel: {
    width: 70,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  weekListDayName: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  weekListDayNumber: {
    fontSize: 18,
  },
  weekListTasks: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    justifyContent: 'center',
  },
  weekListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  weekListTasksContent: {
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  weekListTaskCard: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 100,
    maxWidth: 160,
  },
  weekListTaskTitle: {
    fontSize: 12,
    fontWeight: '500',
  }
});
