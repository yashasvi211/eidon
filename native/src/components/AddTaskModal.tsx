import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  useColorScheme, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { validateReminder } from '@/services/notifications';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  name: string;
  color: string;
}

export interface ReminderConfig {
  remindBefore: number;    // ms before due date
  repeatEvery?: number;    // ms between repeat notifications
}

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, project: string, due?: string, reminder?: ReminderConfig, dueTime?: string) => void;
  projects: Project[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const INBOX_PROJECT: Project = { name: 'Inbox', color: '#58a6ff' };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Remind-before presets (label + ms value) */
const REMIND_PRESETS = [
  { label: '1 hour',  value: 60 * 60 * 1000 },
  { label: '1 day',   value: 24 * 60 * 60 * 1000 },
  { label: '1 week',  value: 7 * 24 * 60 * 60 * 1000 },
];

/** All possible repeat-every options (filtered dynamically) */
const REPEAT_OPTIONS = [
  { label: '5s ⚡',    value: 5 * 1000,                 },
  { label: '2 min',      value: 2 * 60 * 1000,            },
  { label: '30 min',   value: 30 * 60 * 1000,           },
  { label: '1 hour',   value: 60 * 60 * 1000,           },
  { label: '2 hours',  value: 2 * 60 * 60 * 1000,       },
  { label: '1 day',    value: 24 * 60 * 60 * 1000,      },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function fmtDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

// ─── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ selectedDate, onSelect, colors }: {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  colors: any;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  // Build cells: leading blanks + actual days
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth <= today.getMonth());

  const goToPrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const goToNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <View style={[calStyles.container, { backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}>
      {/* Month navigation */}
      <View style={calStyles.header}>
        <TouchableOpacity onPress={goToPrev} disabled={!canGoPrev} style={calStyles.navBtn}>
          <Feather name="chevron-left" size={16} color={canGoPrev ? colors.ghText : colors.ghBorder} />
        </TouchableOpacity>
        <Text style={[calStyles.monthLabel, { color: colors.ghText }]}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={goToNext} style={calStyles.navBtn}>
          <Feather name="chevron-right" size={16} color={colors.ghText} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={calStyles.weekRow}>
        {DAY_LABELS.map(d => (
          <View key={d} style={calStyles.cell}>
            <Text style={[calStyles.weekLabel, { color: colors.ghMuted }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={calStyles.cell} />;

          const dateObj = new Date(viewYear, viewMonth, day);
          dateObj.setHours(0, 0, 0, 0);
          const isPast = dateObj < today;
          const dateStr = fmtDate(viewYear, viewMonth, day);
          const isSelected = dateStr === selectedDate;
          const isToday = viewYear === today.getFullYear()
            && viewMonth === today.getMonth()
            && day === today.getDate();

          return (
            <TouchableOpacity
              key={day}
              style={[
                calStyles.cell,
                isSelected && [calStyles.selectedCell, { backgroundColor: colors.ghBlue }],
                isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.ghBlue, borderRadius: 18 },
              ]}
              disabled={isPast}
              onPress={() => onSelect(dateStr)}
              activeOpacity={0.6}
            >
              <Text style={[
                calStyles.dayText,
                { color: isPast ? colors.ghBorder : colors.ghText },
                isSelected && { color: '#fff', fontWeight: '700' },
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

export default function AddTaskModal({ visible, onClose, onAdd, projects }: AddTaskModalProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Form state
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('Inbox');
  const [due, setDue] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [timeHour, setTimeHour] = useState('');
  const [timeMinute, setTimeMinute] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

  // Reminder state
  const [remindBefore, setRemindBefore] = useState<number | null>(null);   // ms
  const [customHours, setCustomHours] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [repeatEvery, setRepeatEvery] = useState<number | null>(null);     // ms

  // ── Derived ──

  // Ensure Inbox is always first in the project list
  const allProjects = useMemo(() => {
    const hasInbox = projects.some(p => p.name === 'Inbox');
    return hasInbox ? projects : [INBOX_PROJECT, ...projects];
  }, [projects]);

  // Validation
  const reminderValidation = useMemo(() => {
    if (!due || remindBefore === null) return null;
    return validateReminder(due, dueTime || undefined, remindBefore);
  }, [due, dueTime, remindBefore]);

  // Filter repeat options: interval must be ≤ remindBefore
  const availableRepeatOptions = useMemo(() => {
    if (remindBefore === null) return [];
    return REPEAT_OPTIONS.filter(opt => opt.value <= remindBefore);
  }, [remindBefore]);

  // ── Handlers ──

  const reset = () => {
    setTitle('');
    setProject('Inbox');
    setDue(null);
    setDueTime(null);
    setTimeHour('');
    setTimeMinute('');
    setShowCalendar(false);
    setRemindBefore(null);
    setCustomHours('');
    setIsCustom(false);
    setRepeatEvery(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (reminderValidation) return;  // block if validation error

    let reminder: ReminderConfig | undefined;
    if (due && remindBefore !== null) {
      reminder = { remindBefore };
      if (repeatEvery !== null) {
        reminder.repeatEvery = repeatEvery;
      }
    }

    onAdd(title.trim(), project, due || undefined, reminder, dueTime || undefined);
    reset();
    onClose();
  };

  const handleSelectPreset = (val: number) => {
    setIsCustom(false);
    setCustomHours('');
    if (remindBefore === val) {
      setRemindBefore(null);
      setRepeatEvery(null);
    } else {
      setRemindBefore(val);
      // Clear repeat if it's now invalid
      if (repeatEvery !== null && repeatEvery > val) setRepeatEvery(null);
    }
  };

  const handleCustomToggle = () => {
    if (isCustom) {
      setIsCustom(false);
      setCustomHours('');
      setRemindBefore(null);
      setRepeatEvery(null);
    } else {
      setIsCustom(true);
      setRemindBefore(null);
      setRepeatEvery(null);
    }
  };

  const handleCustomHoursChange = (text: string) => {
    setCustomHours(text);
    const hours = parseFloat(text);
    if (!isNaN(hours) && hours > 0) {
      const ms = Math.round(hours * 60 * 60 * 1000);
      setRemindBefore(ms);
      if (repeatEvery !== null && repeatEvery > ms) setRepeatEvery(null);
    } else {
      setRemindBefore(null);
      setRepeatEvery(null);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    setDue(dateStr);
    // If the new date invalidates the reminder, clear it
    if (remindBefore !== null) {
      const err = validateReminder(dateStr, dueTime || undefined, remindBefore);
      if (err) {
        setRemindBefore(null);
        setRepeatEvery(null);
        setIsCustom(false);
        setCustomHours('');
      }
    }
  };

  const handleClearDate = () => {
    setDue(null);
    setDueTime(null);
    setTimeHour('');
    setTimeMinute('');
    setRemindBefore(null);
    setRepeatEvery(null);
    setIsCustom(false);
    setCustomHours('');
    setShowCalendar(false);
  };

  const canSubmit = title.trim().length > 0 && !reminderValidation;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalTitle, { color: colors.ghText }]}>New Task</Text>

            {/* ── Title ── */}
            <Text style={[styles.label, { color: colors.ghMuted }]}>Title</Text>
            <TextInput
              style={[styles.input, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.ghMuted}
              value={title}
              onChangeText={setTitle}
              autoFocus
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

            {/* ── Due Date ── */}
            <Text style={[styles.label, { color: colors.ghMuted }]}>Due Date</Text>
            <View style={styles.dueDateRow}>
              <TouchableOpacity
                style={[
                  styles.dateBtn,
                  {
                    backgroundColor: colors.ghBg,
                    borderColor: due ? colors.ghBlue : colors.ghBorder,
                  },
                ]}
                onPress={() => setShowCalendar(true)}
              >
                <Feather name="calendar" size={14} color={due ? colors.ghBlue : colors.ghMuted} />
                <Text style={{ color: due ? colors.ghText : colors.ghMuted, fontSize: 13, flex: 1 }}>
                  {due ? `${fmtDateDisplay(due)}${dueTime ? ` @ ${dueTime}` : ''}` : 'Select date & time…'}
                </Text>
              </TouchableOpacity>
              {due && (
                <TouchableOpacity
                  style={[styles.clearBtn, { backgroundColor: colors.ghSurface2 }]}
                  onPress={handleClearDate}
                >
                  <Feather name="x" size={14} color={colors.ghMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Calendar Modal */}
            <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
              <View style={styles.overlay}>
                <View style={[styles.calendarModal, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
                  <Text style={[styles.modalTitle, { color: colors.ghText, marginBottom: 12 }]}>Select Due Date & Time</Text>

                  <MiniCalendar
                    selectedDate={due}
                    onSelect={handleSelectDate}
                    colors={colors}
                  />

                  {due && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.label, { color: colors.ghMuted, marginTop: 4, marginBottom: 6 }]}>Due Time (Optional)</Text>
                      
                      <View style={[styles.chipRow, { marginBottom: 8 }]}>
                        {['09:00', '12:00', '15:00', '18:00', '21:00'].map((time) => {
                          const active = dueTime === time;
                          return (
                            <TouchableOpacity
                              key={time}
                              style={[
                                styles.chip,
                                {
                                  borderColor: active ? colors.ghBlue : colors.ghBorder,
                                  backgroundColor: active ? colors.ghBlue + '18' : 'transparent',
                                  paddingVertical: 4,
                                  paddingHorizontal: 8,
                                },
                              ]}
                              onPress={() => {
                                if (active) {
                                  setDueTime(null);
                                  setTimeHour('');
                                  setTimeMinute('');
                                } else {
                                  setDueTime(time);
                                  const [h, m] = time.split(':');
                                  setTimeHour(h);
                                  setTimeMinute(m);
                                }
                              }}
                            >
                              <Text style={{ color: active ? colors.ghBlue : colors.ghMuted, fontSize: 11, fontWeight: '500' }}>
                                {time}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Custom Time Inputs */}
                      <View style={[styles.customRow, { marginTop: 4, alignItems: 'center', gap: 6 }]}>
                        <TextInput
                          style={[
                            styles.customInput,
                            { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder, width: 44, height: 32, paddingHorizontal: 4, fontSize: 13 },
                          ]}
                          placeholder="HH"
                          placeholderTextColor={colors.ghMuted}
                          value={timeHour}
                          onChangeText={(val) => {
                            const clean = val.replace(/[^0-9]/g, '').slice(0, 2);
                            setTimeHour(clean);
                            const h = parseInt(clean, 10);
                            const m = parseInt(timeMinute || '0', 10);
                            if (clean.length > 0 && !isNaN(h) && h >= 0 && h <= 23) {
                              setDueTime(`${clean.padStart(2, '0')}:${(timeMinute || '00').padStart(2, '0')}`);
                            } else if (clean === '') {
                              setDueTime(null);
                            }
                          }}
                          keyboardType="number-pad"
                        />
                        <Text style={{ color: colors.ghText, fontWeight: 'bold' }}>:</Text>
                        <TextInput
                          style={[
                            styles.customInput,
                            { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder, width: 44, height: 32, paddingHorizontal: 4, fontSize: 13 },
                          ]}
                          placeholder="MM"
                          placeholderTextColor={colors.ghMuted}
                          value={timeMinute}
                          onChangeText={(val) => {
                            const clean = val.replace(/[^0-9]/g, '').slice(0, 2);
                            setTimeMinute(clean);
                            const h = parseInt(timeHour || '12', 10);
                            const m = parseInt(clean, 10);
                            if (clean.length > 0 && !isNaN(m) && m >= 0 && m <= 59) {
                              setDueTime(`${(timeHour || '12').padStart(2, '0')}:${clean.padStart(2, '0')}`);
                            } else if (clean === '') {
                              setDueTime(timeHour ? `${timeHour.padStart(2, '0')}:00` : null);
                            }
                          }}
                          keyboardType="number-pad"
                        />
                        <Text style={[styles.customLabel, { color: colors.ghMuted, fontSize: 11 }]}>Custom 24h Time</Text>
                      </View>
                    </View>
                  )}

                  <View style={[styles.actions, { marginTop: 16 }]}>
                    {due && (
                      <TouchableOpacity
                        style={[styles.btn, { borderColor: colors.ghRed, paddingVertical: 8, paddingHorizontal: 12 }]}
                        onPress={() => { handleClearDate(); }}
                      >
                        <Text style={{ color: colors.ghRed, fontSize: 12, fontWeight: '500' }}>Clear</Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={[styles.btn, { borderColor: colors.ghBorder, paddingVertical: 8, paddingHorizontal: 12 }]}
                      onPress={() => setShowCalendar(false)}
                    >
                      <Text style={{ color: colors.ghMuted, fontSize: 12, fontWeight: '500' }}>
                        {due ? 'Done' : 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* ── Remind Me (only when due date is set) ── */}
            {due && (
              <>
                <View style={styles.sectionHeader}>
                  <Feather name="bell" size={13} color={colors.ghMuted} />
                  <Text style={[styles.label, { color: colors.ghMuted, marginTop: 0, marginBottom: 0 }]}>
                    Remind Me
                  </Text>
                </View>

                <View style={styles.chipRow}>
                  {REMIND_PRESETS.map((preset) => {
                    const active = !isCustom && remindBefore === preset.value;
                    // Check if this preset is feasible
                    const err = validateReminder(due, dueTime || undefined, preset.value);
                    const disabled = !!err;
                    return (
                      <TouchableOpacity
                        key={preset.value}
                        style={[
                          styles.chip,
                          {
                            borderColor: active ? colors.ghBlue : colors.ghBorder,
                            backgroundColor: active ? colors.ghBlue + '18' : 'transparent',
                            opacity: disabled ? 0.4 : 1,
                          },
                        ]}
                        onPress={() => handleSelectPreset(preset.value)}
                        disabled={disabled}
                      >
                        <Text style={{
                          color: active ? colors.ghBlue : colors.ghMuted,
                          fontSize: 12, fontWeight: '500',
                        }}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Custom chip */}
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      {
                        borderColor: isCustom ? colors.ghPurple : colors.ghBorder,
                        backgroundColor: isCustom ? colors.ghPurple + '18' : 'transparent',
                      },
                    ]}
                    onPress={handleCustomToggle}
                  >
                    <Text style={{
                      color: isCustom ? colors.ghPurple : colors.ghMuted,
                      fontSize: 12, fontWeight: '500',
                    }}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom hours input */}
                {isCustom && (
                  <View style={styles.customRow}>
                    <TextInput
                      style={[
                        styles.customInput,
                        { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder },
                      ]}
                      placeholder="e.g. 3"
                      placeholderTextColor={colors.ghMuted}
                      value={customHours}
                      onChangeText={handleCustomHoursChange}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[styles.customLabel, { color: colors.ghMuted }]}>hours before</Text>
                  </View>
                )}

                {/* Validation error */}
                {reminderValidation && (
                  <View style={styles.validationRow}>
                    <Feather name="alert-circle" size={12} color={colors.ghAmber} />
                    <Text style={[styles.validationText, { color: colors.ghAmber }]}>
                      {reminderValidation}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ── Repeat Every (only when remind-before is set and valid) ── */}
            {due && remindBefore !== null && !reminderValidation && (
              <>
                <View style={styles.sectionHeader}>
                  <Feather name="repeat" size={13} color={colors.ghMuted} />
                  <Text style={[styles.label, { color: colors.ghMuted, marginTop: 0, marginBottom: 0 }]}>
                    Repeat Every
                  </Text>
                </View>

                {availableRepeatOptions.length > 0 ? (
                  <View style={styles.chipRow}>
                    {availableRepeatOptions.map((opt) => {
                      const active = repeatEvery === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.chip,
                            {
                              borderColor: active ? colors.ghGreen : colors.ghBorder,
                              backgroundColor: active ? colors.ghGreen + '18' : 'transparent',
                            },
                          ]}
                          onPress={() => setRepeatEvery(active ? null : opt.value)}
                        >
                          <Text style={{
                            color: active ? colors.ghGreen : colors.ghMuted,
                            fontSize: 12, fontWeight: '500',
                          }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.hintText, { color: colors.ghMuted }]}>
                    Remind-before window is too short for repeat intervals.
                  </Text>
                )}

                {repeatEvery !== null && repeatEvery <= 5000 && (
                  <View style={styles.validationRow}>
                    <Feather name="zap" size={12} color={colors.ghAmber} />
                    <Text style={[styles.validationText, { color: colors.ghAmber }]}>
                      Testing mode — fires every 5 seconds
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ── Summary ── */}
            {due && remindBefore !== null && !reminderValidation && (
              <View style={[styles.summaryBox, { backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}>
                <Feather name="info" size={12} color={colors.ghBlue} />
                <Text style={[styles.summaryText, { color: colors.ghMuted }]}>
                  {'Reminder starts '}
                  <Text style={{ fontWeight: '600', color: colors.ghText }}>
                    {REMIND_PRESETS.find(p => p.value === remindBefore)?.label
                      || `${customHours}h`}
                  </Text>
                  {' before due'}
                  {repeatEvery ? (
                    <>
                      {', repeating '}
                      <Text style={{ fontWeight: '600', color: colors.ghText }}>
                        every {REPEAT_OPTIONS.find(o => o.value === repeatEvery)?.label || '?'}
                      </Text>
                    </>
                  ) : (
                    ' (once)'
                  )}
                </Text>
              </View>
            )}

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
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const calStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: {
    padding: 6,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedCell: {
    borderRadius: 18,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '400',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
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
