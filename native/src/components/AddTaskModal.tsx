import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  useColorScheme, KeyboardAvoidingView, Platform, ScrollView,
  Animated as RNAnimated, useWindowDimensions
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Colors } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { validateReminder } from '@/services/notifications';
import { getValidOffsets, getValidRepeats, generateSchedulePreview, countTotalReminders, Preset, formatEstimateDisplay } from '@/services/reminderUtils';

const DISMISS_THRESHOLD = 120;
const OPEN_SPRING = { damping: 28, stiffness: 220, mass: 0.9 };
const SNAP_SPRING = { damping: 24, stiffness: 300, mass: 0.7 };
const EXIT_DURATION = 250;
const EXIT_EASING = Easing.bezierFn(0.4, 0, 1, 1);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  name: string;
  color: string;
}

export interface ReminderConfig {
  remindBefore: number;    // ms before due date
  repeatEvery?: number;    // ms between repeat notifications
}

export interface TaskRecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  streakEnabled: boolean;
}

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, project: string, due?: string, reminder?: ReminderConfig, dueTime?: string, priority?: 'High' | 'Moderate' | 'Low', execStartDate?: string, execStartTime?: string, recurrence?: TaskRecurrenceConfig, est?: string) => void;
  projects: Project[];
  initialTask?: any;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const INBOX_PROJECT: Project = { name: 'Inbox', color: '#58a6ff' };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function fmtDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function formatTime12h(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

import AnalogClockModal from './sub_components/AnalogClockModal';
import CalendarModal from './sub_components/CalendarModal';
import ConfirmationModal from './sub_components/ConfirmationModal';
import SelectModal from './sub_components/SelectModal';

// ─── Main Modal ────────────────────────────────────────────────────────────────

export default function AddTaskModal({ visible, onClose, onAdd, projects, initialTask }: AddTaskModalProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // Form state
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('Inbox');
  const [due, setDue] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  
  const [execStartDate, setExecStartDate] = useState<string | null>(null);
  const [execStartTime, setExecStartTime] = useState<string | null>(null);

  const [calendarMode, setCalendarMode] = useState<'due' | 'execStart' | null>(null);
  const [clockMode, setClockMode] = useState<'due' | 'execStart' | null>(null);
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [priority, setPriority] = useState<'High' | 'Moderate' | 'Low'>('Low');
  const [est, setEst] = useState('');

  // Reminder state
  const [remindBefore, setRemindBefore] = useState<number | null>(null);   // ms
  const [repeatEvery, setRepeatEvery] = useState<number | null>(null);     // ms

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [streakEnabled, setStreakEnabled] = useState(false);
  
  // Dropdown states
  const [showOffsetDropdown, setShowOffsetDropdown] = useState(false);
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);

  // ── Derived ──

  // Ensure Inbox is always first in the project list
  const allProjects = useMemo(() => {
    const hasInbox = projects.some(p => p.name === 'Inbox');
    return hasInbox ? projects : [INBOX_PROJECT, ...projects];
  }, [projects]);

  const dueDateTimeMs = useMemo(() => {
    if (!due) return null;
    const [y, m, d] = due.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dueTime) {
      const [h, min] = dueTime.split(':').map(Number);
      dateObj.setHours(h, min, 0, 0);
    } else {
      dateObj.setHours(0, 0, 0, 0);
    }
    return dateObj.getTime();
  }, [due, dueTime]);

  const availableOffsets = useMemo(() => {
    if (!dueDateTimeMs) return [];
    return getValidOffsets(dueDateTimeMs);
  }, [dueDateTimeMs]);

  const availableRepeatOptions = useMemo(() => {
    if (remindBefore === null) return [];
    return getValidRepeats(remindBefore);
  }, [remindBefore]);

  const schedulePreview = useMemo(() => {
    if (!dueDateTimeMs || remindBefore === null) return [];
    return generateSchedulePreview(dueDateTimeMs, remindBefore, repeatEvery || 0);
  }, [dueDateTimeMs, remindBefore, repeatEvery]);

  const totalReminders = useMemo(() => {
    if (!dueDateTimeMs || remindBefore === null) return 0;
    return countTotalReminders(dueDateTimeMs, remindBefore, repeatEvery || 0);
  }, [dueDateTimeMs, remindBefore, repeatEvery]);

  // ── Animations ──
  const translateY = useSharedValue(isLargeScreen ? 0 : height);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      reset();
      if (!isLargeScreen) {
        translateY.value = height;
        translateY.value = withSpring(0, OPEN_SPRING);
      } else {
        translateY.value = 0;
      }
    }
  }, [visible, initialTask, isLargeScreen]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetY([10, -10])
      .failOffsetX([-15, 15])
      .onUpdate((e) => {
        dragY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 800) {
          translateY.value = withTiming(height, {
            duration: EXIT_DURATION,
            easing: EXIT_EASING,
          }, () => {
            runOnJS(onClose)();
          });
          dragY.value = withTiming(0, { duration: EXIT_DURATION });
        } else {
          dragY.value = withSpring(0, SNAP_SPRING);
        }
      });
  }, [height, onClose]);

  const rootAnimatedStyle = useAnimatedStyle(() => {
    if (isLargeScreen) return {};
    return {
      transform: [{ translateY: translateY.value + dragY.value }],
      opacity: interpolate(
        translateY.value + dragY.value,
        [0, height * 0.5],
        [1, 0.85],
        Extrapolation.CLAMP,
      ),
    };
  }, [isLargeScreen, height]);

  const animateClose = (callback: () => void) => {
    if (!isLargeScreen) {
      translateY.value = withTiming(height, {
        duration: EXIT_DURATION,
        easing: EXIT_EASING,
      }, () => {
        runOnJS(callback)();
      });
    } else {
      callback();
    }
  };

  // ── Handlers ──

  const reset = () => {
    if (initialTask) {
      setTitle(initialTask.title);
      setProject(initialTask.target || 'Inbox');
      setDue(initialTask.due || null);
      setDueTime(initialTask.dueTime || null);
      setRemindBefore(initialTask.reminder?.remindBefore ?? null);
      setRepeatEvery(initialTask.reminder?.repeatEvery ?? null);
      setPriority(initialTask.priority || 'Low');
      setExecStartDate(initialTask.execStartDate || null);
      setExecStartTime(initialTask.execStartTime || null);
      setIsRecurring(!!initialTask.recurrence);
      setRecurrenceFrequency(initialTask.recurrence?.frequency || 'daily');
      setStreakEnabled(initialTask.recurrence?.streakEnabled || false);
      setEst(initialTask.est || '');
    } else {
      setTitle('');
      setProject('Inbox');
      setDue(null);
      setDueTime(null);
      setRemindBefore(null);
      setRepeatEvery(null);
      setPriority('Low');
      setEst('');
      setExecStartDate(null);
      setExecStartTime(null);
      setIsRecurring(false);
      setRecurrenceFrequency('daily');
      setStreakEnabled(false);
    }
    setCalendarMode(null);
    setClockMode(null);
    setShowConfirm(false);
    setShowOffsetDropdown(false);
    setShowRepeatDropdown(false);
  };

  const handleClose = () => {
    animateClose(() => {
      reset();
      onClose();
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    let reminder: ReminderConfig | undefined;
    if (due && remindBefore !== null) {
      reminder = { remindBefore };
      if (repeatEvery !== null) {
        reminder.repeatEvery = repeatEvery;
      }
    }

    const recurrenceConfig: TaskRecurrenceConfig | undefined = isRecurring
      ? { frequency: recurrenceFrequency, streakEnabled }
      : undefined;

    animateClose(() => {
      onAdd(title.trim(), project, due || undefined, reminder, dueTime || undefined, priority, execStartDate || undefined, execStartTime || undefined, recurrenceConfig, formatEstimateDisplay(est) || undefined);
      reset();
      onClose();
    });
  };

  const handleSelectPreset = (val: number) => {
    if (remindBefore === val) {
      setRemindBefore(null);
      setRepeatEvery(null);
    } else {
      setRemindBefore(val);
      if (repeatEvery !== null && repeatEvery >= val) setRepeatEvery(null);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    // dateStr comes from CalendarModal as DD/MM/YYYY, but validateReminder/backend expect YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      
      if (calendarMode === 'due') {
        setDue(formattedDate);
        
        // Check if current remindBefore is still valid
      if (remindBefore !== null) {
        const dueMs = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${dueTime || '00:00'}:00`).getTime();
        const maxOffset = dueMs - Date.now();
        if (remindBefore > maxOffset) {
          setRemindBefore(null);
          setRepeatEvery(null);
        }
      }
      } else if (calendarMode === 'execStart') {
        setExecStartDate(formattedDate);
      }
    }
  };

  const handleSelectTime = (timeStr: string) => {
    // timeStr comes as HH:MM AM/PM
    // convert to HH:MM 24h format
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      const formattedTime = `${h.toString().padStart(2, '0')}:${m}`;
      
      if (clockMode === 'due') {
        setDueTime(formattedTime);
      } else if (clockMode === 'execStart') {
        setExecStartTime(formattedTime);
      }
    }
  };

  const handleClearDate = () => {
    setDue(null);
    setDueTime(null);
    setExecStartDate(null);
    setExecStartTime(null);
    setRemindBefore(null);
    setRepeatEvery(null);
    setCalendarMode(null);
    setClockMode(null);
  };

  const isPastDue = due !== null && dueTime !== null && dueDateTimeMs !== null && dueDateTimeMs <= Date.now();
  const hasDateButNoTime = due !== null && dueTime === null;
  const hasTimeButNoDate = due === null && dueTime !== null;
  
  const hasPartialExec = (execStartDate !== null || execStartTime !== null) && 
                         (execStartDate === null || execStartTime === null);
                         
  let isExecInvalid = false;
  let execError = "";
  if (execStartDate && execStartTime) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = execStartDate.split('-').map(Number);
    const execStart = new Date(y, m - 1, d);
    const [sh, sm] = execStartTime.split(':').map(Number);
    execStart.setHours(sh, sm, 0, 0);
    
    if (execStart.getTime() < Date.now()) {
       isExecInvalid = true;
       execError = "Execution start cannot be in the past";
    } else if (dueDateTimeMs && execStart.getTime() >= dueDateTimeMs) {
       isExecInvalid = true;
       execError = "Execution start cannot be after or at due time";
    }
  }

  const canSubmit = title.trim().length > 0 && (isRecurring || due !== null) && !hasDateButNoTime && !hasTimeButNoDate && !isPastDue && !hasPartialExec && !isExecInvalid;

  if (!visible) return null;

  const dragArea = (
    <>
      {!isLargeScreen && (
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.ghBorder2 }]} />
        </View>
      )}
      <View style={[styles.header, { borderBottomColor: colors.ghBorder }]}>
        <Text style={[styles.headerTitle, { color: colors.ghText }]} numberOfLines={1}>
          {initialTask ? 'Edit Task' : 'Add Task'}
        </Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Text style={{ color: colors.ghMuted, fontSize: 20 }}>×</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {!isLargeScreen && (
        <View style={styles.backdropContainer}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={handleClose}
          />
        </View>
      )}
      <Animated.View
        style={[
          styles.panelContainer,
          {
            backgroundColor: colors.ghBg,
            borderLeftColor: colors.ghBorder,
            borderLeftWidth: isLargeScreen ? 1 : 0,
            borderTopLeftRadius: isLargeScreen ? 0 : 16,
            borderTopRightRadius: isLargeScreen ? 0 : 16,
          },
          rootAnimatedStyle,
        ]}
      >
        {!isLargeScreen ? (
          <GestureDetector gesture={panGesture}>
            <Animated.View>{dragArea}</Animated.View>
          </GestureDetector>
        ) : (
          dragArea
        )}

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
              {/* ── Title ── */}
              <Text style={[styles.label, { color: colors.ghMuted }]}>Title</Text>
              <TextInput
                style={[styles.input, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.ghMuted}
                value={title}
                onChangeText={setTitle}
              />

              {/* ── Project ── */}
              <Text style={[styles.label, { color: colors.ghMuted }]}>Project</Text>
              <View style={styles.chipRow}>
                {allProjects.map((p) => (
                  <TouchableOpacity
                    key={p.name}
                    style={[
                      styles.chip,
                      {
                        borderColor: project === p.name ? p.color : colors.ghBorder,
                        backgroundColor: project === p.name ? p.color + '18' : 'transparent',
                      },
                    ]}
                    onPress={() => setProject(p.name)}
                  >
                    <Text style={{ color: project === p.name ? p.color : colors.ghMuted, fontSize: 12, fontWeight: '500' }}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Priority ── */}
              <Text style={[styles.label, { color: colors.ghMuted, marginTop: 16 }]}>Priority</Text>
              <View style={styles.chipRow}>
                {[
                  { label: 'High', color: colors.ghRed || '#f85149' },
                  { label: 'Moderate', color: colors.ghAmber || '#d29922' },
                  { label: 'Low', color: colors.ghGreen || '#3fb950' }
                ].map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={[
                      styles.chip,
                      {
                        borderColor: priority === p.label ? p.color : colors.ghBorder,
                        backgroundColor: priority === p.label ? p.color + '18' : 'transparent',
                      },
                    ]}
                    onPress={() => setPriority(p.label as 'High' | 'Moderate' | 'Low')}
                  >
                    <Text style={{ color: priority === p.label ? p.color : colors.ghMuted, fontSize: 12, fontWeight: '500' }}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Estimated Time ── */}
              <Text style={[styles.label, { color: colors.ghMuted, marginTop: 16 }]}>Estimated Time</Text>
              <View style={[styles.chipRow, { flexWrap: 'wrap', gap: 6 }]}>
                {[
                  { label: '15m', val: '15m' },
                  { label: '30m', val: '30m' },
                  { label: '1h', val: '1h' },
                  { label: '2h', val: '2h' },
                  { label: '4h', val: '4h' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.val}
                    style={[
                      styles.chip,
                      {
                        borderColor: est === item.val ? colors.ghPurple : colors.ghBorder,
                        backgroundColor: est === item.val ? colors.ghPurple + '18' : 'transparent',
                      },
                    ]}
                    onPress={() => setEst(est === item.val ? '' : item.val)}
                  >
                    <Text style={{ color: est === item.val ? colors.ghPurple : colors.ghMuted, fontSize: 12, fontWeight: '500' }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[
                    styles.chip,
                    {
                      color: colors.ghText,
                      fontSize: 12,
                      borderColor: (est && !['15m', '30m', '1h', '2h', '4h'].includes(est)) ? colors.ghPurple : colors.ghBorder,
                      backgroundColor: (est && !['15m', '30m', '1h', '2h', '4h'].includes(est)) ? colors.ghPurple + '18' : 'transparent',
                      minWidth: 75,
                      paddingVertical: 4,
                      textAlign: 'center'
                    }
                  ]}
                  placeholder="Custom..."
                  placeholderTextColor={colors.ghMuted}
                  value={['15m', '30m', '1h', '2h', '4h'].includes(est) ? '' : est}
                  onChangeText={setEst}
                />
              </View>

              {/* ── Due Date & Time ── */}
              <View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.ghMuted }]}>Due Date</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.ghMuted }]}>Due Time *</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[
                      styles.dateBtn,
                      {
                        backgroundColor: colors.ghBg,
                        borderColor: due ? colors.ghBlue : colors.ghBorder,
                      },
                    ]}
                    onPress={() => setCalendarMode('due')}
                  >
                    <Feather name="calendar" size={14} color={due ? colors.ghBlue : colors.ghMuted} />
                    <Text style={{ color: due ? colors.ghText : colors.ghMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {due ? fmtDateDisplay(due) : 'Select date…'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.dateBtn,
                      {
                        backgroundColor: colors.ghBg,
                        borderColor: dueTime ? colors.ghBlue : colors.ghBorder,
                      },
                    ]}
                    onPress={() => setClockMode('due')}
                  >
                    <Feather name="clock" size={14} color={dueTime ? colors.ghBlue : colors.ghMuted} />
                    <Text style={{ color: dueTime ? colors.ghText : colors.ghMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {dueTime ? formatTime12h(dueTime) : 'Select time…'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {isPastDue && (
                  <Text style={{ color: colors.ghRed || '#f85149', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                    * Due time cannot be in the past
                  </Text>
                )}
              </View>

              {/* Calendar & Clock Modals */}
              {/* ── Execution Plan ── */}
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.label, { color: colors.ghMuted }]}>Execution Plan</Text>
                
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.dateBtn,
                      {
                        backgroundColor: colors.ghBg,
                        borderColor: execStartDate ? colors.ghBlue : colors.ghBorder,
                      },
                    ]}
                    onPress={() => setCalendarMode('execStart')}
                  >
                    <Feather name="calendar" size={14} color={execStartDate ? colors.ghBlue : colors.ghMuted} />
                    <Text style={{ color: execStartDate ? colors.ghText : colors.ghMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {execStartDate ? fmtDateDisplay(execStartDate) : 'Start Date…'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.dateBtn,
                      {
                        backgroundColor: colors.ghBg,
                        borderColor: execStartTime ? colors.ghBlue : colors.ghBorder,
                      },
                    ]}
                    onPress={() => setClockMode('execStart')}
                  >
                    <Feather name="clock" size={14} color={execStartTime ? colors.ghBlue : colors.ghMuted} />
                    <Text style={{ color: execStartTime ? colors.ghText : colors.ghMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {execStartTime ? formatTime12h(execStartTime) : 'Start Time…'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {hasPartialExec && (
                  <Text style={{ color: colors.ghRed || '#f85149', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                    * All execution fields must be filled if one is set
                  </Text>
                )}
                {isExecInvalid && (
                  <Text style={{ color: colors.ghRed || '#f85149', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                    * {execError}
                  </Text>
                )}
              </View>

              {/* Calendar & Clock Modals */}
              <CalendarModal
                visible={calendarMode !== null}
                onClose={() => setCalendarMode(null)}
                onSelectDate={handleSelectDate}
                initialDateStr={
                  calendarMode === 'due' && due 
                    ? due.split('-').reverse().join('/') 
                    : calendarMode === 'execStart' && execStartDate
                      ? execStartDate.split('-').reverse().join('/')
                      : ''
                }
                colors={colors}
                minDate={calendarMode === 'execStart' ? new Date().toISOString().split('T')[0] : undefined}
                maxDate={calendarMode === 'execStart' && due ? due : undefined}
              />

              <AnalogClockModal
                visible={clockMode !== null}
                onClose={() => setClockMode(null)}
                onSelectTime={handleSelectTime}
                initialTimeStr={
                  (() => {
                    let t = null;
                    if (clockMode === 'due') t = dueTime;
                    else if (clockMode === 'execStart') t = execStartTime;

                    if (t) {
                      const [h, m] = t.split(':').map(Number);
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const hour12 = h % 12 || 12;
                      return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
                    }
                    return '09:00 AM';
                  })()
                }
                colors={colors}
                title={clockMode === 'due' ? "Select Due Time" : "Select Start Time"}
                minTime={(() => {
                  if (clockMode === 'execStart' && execStartDate) {
                    const today = new Date();
                    const [y, m, d] = execStartDate.split('-').map(Number);
                    if (today.getFullYear() === y && today.getMonth() === m - 1 && today.getDate() === d) {
                       return `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
                    }
                  }
                  return undefined;
                })()}
                maxTime={(() => {
                  if (clockMode === 'execStart' && due && execStartDate === due && dueTime) {
                    return dueTime;
                  }
                  return undefined;
                })()}
              />

              {/* ── Reminders (Side by Side layout) ── */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                {/* Start Reminding */}
                <View style={{ flex: 1 }}>
                  <View style={[styles.sectionHeader, { marginTop: 0 }]}>
                    <Feather name="bell" size={13} color={colors.ghMuted} />
                    <Text style={[styles.label, { color: colors.ghMuted, marginTop: 0, marginBottom: 0 }]}>
                      Start Reminding
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.dateBtn,
                      {
                        borderColor: colors.ghBorder,
                        backgroundColor: colors.ghBg,
                        opacity: !due ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => { if (due) setShowOffsetDropdown(true); }}
                    disabled={!due || availableOffsets.length === 0}
                  >
                    <Text style={{ color: remindBefore !== null ? colors.ghText : colors.ghMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {remindBefore !== null ? availableOffsets.find(p => p.value === remindBefore)?.label : (due && availableOffsets.length === 0 ? 'Due too soon' : 'Select...')}
                    </Text>
                    <Feather name="chevron-down" size={16} color={colors.ghMuted} />
                  </TouchableOpacity>
                </View>

                {/* Repeat Every */}
                <View style={{ flex: 1 }}>
                  <View style={[styles.sectionHeader, { marginTop: 0 }]}>
                    <Feather name="repeat" size={13} color={colors.ghMuted} />
                    <Text style={[styles.label, { color: colors.ghMuted, marginTop: 0, marginBottom: 0 }]}>
                      Repeat Every
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.dateBtn,
                      {
                        borderColor: colors.ghBorder,
                        backgroundColor: colors.ghBg,
                        opacity: remindBefore === null ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => { if (remindBefore !== null) setShowRepeatDropdown(true); }}
                    disabled={remindBefore === null || availableRepeatOptions.length === 0}
                  >
                    <Text style={{ color: repeatEvery !== null ? colors.ghText : colors.ghMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {repeatEvery !== null ? availableRepeatOptions.find(p => p.value === repeatEvery)?.label : (remindBefore !== null && availableRepeatOptions.length === 0 ? 'No repeats fit' : 'Once')}
                    </Text>
                    <Feather name="chevron-down" size={16} color={colors.ghMuted} />
                  </TouchableOpacity>
                </View>
              </View>


              {/* ── Total Reminders ── */}
              {due && remindBefore !== null && schedulePreview.length > 0 && (
                <View style={[styles.summaryBox, { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ghBg, borderColor: colors.ghBorder, marginTop: 16 }]}>
                  <Feather name="bell" size={14} color={colors.ghBlue} />
                  <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>
                    Total Reminders: {totalReminders}
                  </Text>
                </View>
              )}

              {/* ── Recurring Task Section ── */}
              <View style={{ marginTop: 20 }}>
                {/* Toggle Row */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ghBg, borderWidth: 1, borderColor: isRecurring ? colors.ghBlue : colors.ghBorder, borderRadius: 10, padding: 14 }}
                  onPress={() => {
                    setIsRecurring(v => !v);
                    if (isRecurring) setStreakEnabled(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: isRecurring ? `${colors.ghBlue}20` : `${colors.ghMuted}12`, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="repeat" size={14} color={isRecurring ? colors.ghBlue : colors.ghMuted} />
                    </View>
                    <View>
                      <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: '600' }}>Recurring Task</Text>
                      <Text style={{ color: colors.ghMuted, fontSize: 11, marginTop: 1 }}>Resets automatically on schedule</Text>
                    </View>
                  </View>
                  {/* Checkbox */}
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isRecurring ? colors.ghBlue : colors.ghBorder, backgroundColor: isRecurring ? colors.ghBlue : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {isRecurring && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                  </View>
                </TouchableOpacity>

                {/* Frequency + Streak Options (shown when recurring is ON) */}
                {isRecurring && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {/* Frequency Selector */}
                    <View>
                      <Text style={[styles.label, { color: colors.ghMuted }]}>Repeat Frequency</Text>
                      <View style={styles.chipRow}>
                        {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                          <TouchableOpacity
                            key={freq}
                            style={[styles.chip, { borderColor: recurrenceFrequency === freq ? colors.ghBlue : colors.ghBorder, backgroundColor: recurrenceFrequency === freq ? `${colors.ghBlue}18` : 'transparent' }]}
                            onPress={() => setRecurrenceFrequency(freq)}
                          >
                            <Text style={{ color: recurrenceFrequency === freq ? colors.ghBlue : colors.ghMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                              {freq}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Streak Tracking Toggle */}
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: streakEnabled ? 'rgba(240,136,62,0.06)' : colors.ghBg, borderWidth: 1, borderColor: streakEnabled ? 'rgba(240,136,62,0.4)' : colors.ghBorder, borderRadius: 10, padding: 12 }}
                      onPress={() => setStreakEnabled(v => !v)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 18, color: '#f0883e', fontWeight: '800' }}>★</Text>
                        <View>
                          <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: '600' }}>Enable Streak Tracking</Text>
                          <Text style={{ color: colors.ghMuted, fontSize: 11, marginTop: 1 }}>Track your consistency over time</Text>
                        </View>
                      </View>
                      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: streakEnabled ? '#f0883e' : colors.ghBorder, backgroundColor: streakEnabled ? '#f0883e' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {streakEnabled && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                      </View>
                    </TouchableOpacity>

                    {/* Info note about recurring */}
                    <View style={{ backgroundColor: `${colors.ghBlue}08`, borderWidth: 1, borderColor: `${colors.ghBlue}20`, borderRadius: 8, padding: 10 }}>
                      <Text style={{ color: colors.ghMuted, fontSize: 11, lineHeight: 16 }}>
                        📋 The task resets for the next period when you complete it or when the due date passes. {streakEnabled ? '\n★ Streak breaks if you miss a period.' : ''}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

            {/* ── Actions ── */}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: colors.ghBorder }]} onPress={handleClose}>
                <Text style={{ color: colors.ghMuted, fontSize: 13, fontWeight: '500' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btn, styles.primaryBtn,
                  {
                    backgroundColor: canSubmit ? colors.ghBlue : colors.ghBorder,
                    borderColor: canSubmit ? colors.ghBlue : colors.ghBorder,
                  },
                ]}
                onPress={() => setShowConfirm(true)}
                disabled={!canSubmit}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add Task</Text>
              </TouchableOpacity>
            </View>
        </ScrollView>
      </Animated.View>

      <ConfirmationModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Create Task"
        description={`Are you sure you want to add "${title}"?`}
        successText="Task Created Successfully!"
        colors={colors}
      />

      <SelectModal
        visible={showOffsetDropdown}
        onClose={() => setShowOffsetDropdown(false)}
        title="Start Reminding"
        options={availableOffsets}
        selectedValue={remindBefore}
        onSelect={handleSelectPreset}
        colors={colors}
      />

      <SelectModal
        visible={showRepeatDropdown}
        onClose={() => setShowRepeatDropdown(false)}
        title="Repeat Every"
        options={availableRepeatOptions}
        selectedValue={repeatEvery || 0}
        onSelect={(val) => setRepeatEvery(val === 0 ? null : val)}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────



const styles = StyleSheet.create({
  dragHandleContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  backdropContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  backdrop: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panelContainer: {
    flex: 1,
    borderLeftWidth: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  closeBtn: {
    padding: 5,
  },
  scrollContent: {
    flex: 1,
  },
  calendarModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  customInput: {
    width: 70,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  customLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  validationText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '400',
    fontStyle: 'italic',
    marginTop: 4,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtn: {
    borderWidth: 1,
  },
});
