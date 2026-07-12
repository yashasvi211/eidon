import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  useColorScheme, KeyboardAvoidingView, Platform, ScrollView,
  Animated as RNAnimated
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { validateReminder } from '@/services/notifications';
import { getValidOffsets, getValidRepeats, generateSchedulePreview, countTotalReminders, Preset } from '@/services/reminderUtils';

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

export default function AddTaskModal({ visible, onClose, onAdd, projects }: AddTaskModalProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Form state
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('Inbox');
  const [due, setDue] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Reminder state
  const [remindBefore, setRemindBefore] = useState<number | null>(null);   // ms
  const [repeatEvery, setRepeatEvery] = useState<number | null>(null);     // ms
  
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
  const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      RNAnimated.parallel([
        RNAnimated.spring(scaleAnim, {
          toValue: 1,
          tension: 20,
          friction: 10,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const animateClose = (callback: () => void) => {
    RNAnimated.parallel([
      RNAnimated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 250,
        useNativeDriver: true,
      }),
      RNAnimated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  // ── Handlers ──

  const reset = () => {
    setTitle('');
    setProject('Inbox');
    setDue(null);
    setDueTime(null);
    setDueTime(null);
    setShowCalendar(false);
    setShowClock(false);
    setShowConfirm(false);
    setRemindBefore(null);
    setRepeatEvery(null);
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

    animateClose(() => {
      onAdd(title.trim(), project, due || undefined, reminder, dueTime || undefined);
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
      setDueTime(`${h.toString().padStart(2, '0')}:${m}`);
    }
  };

  const handleClearDate = () => {
    setDue(null);
    setDueTime(null);
    setRemindBefore(null);
    setRepeatEvery(null);
    setShowCalendar(false);
    setShowClock(false);
  };

  const canSubmit = title.trim().length > 0 && (!due || (due && dueTime !== null));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <RNAnimated.View style={[styles.modal, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder, transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
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
                  {due ? fmtDateDisplay(due) : 'Select date…'}
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

            {/* Calendar & Clock Modals */}
            <CalendarModal
              visible={showCalendar}
              onClose={() => setShowCalendar(false)}
              onSelectDate={handleSelectDate}
              initialDateStr={due ? due.split('-').reverse().join('/') : ''}
              colors={colors}
            />

            <AnalogClockModal
              visible={showClock}
              onClose={() => setShowClock(false)}
              onSelectTime={handleSelectTime}
              // Basic conversion for initialTimeStr
              initialTimeStr={
                dueTime 
                  ? (() => {
                      const [h, m] = dueTime.split(':').map(Number);
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const hour12 = h % 12 || 12;
                      return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
                    })()
                  : '09:00 AM'
              }
              colors={colors}
              title="Select Due Time"
            />
            
            {/* Time selection when date is selected */}
            {due && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.label, { color: colors.ghMuted, marginTop: 4, marginBottom: 6 }]}>Due Time (Required)</Text>
                
                <View style={[styles.chipRow, { marginBottom: 8 }]}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      {
                        borderColor: dueTime ? colors.ghBlue : colors.ghPurple,
                        backgroundColor: (dueTime ? colors.ghBlue : colors.ghPurple) + '18',
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                      },
                    ]}
                    onPress={() => setShowClock(true)}
                  >
                    <Text style={{ color: dueTime ? colors.ghBlue : colors.ghPurple, fontSize: 12, fontWeight: '600' }}>
                      {dueTime ? `Time: ${formatTime12h(dueTime)}` : 'Select Time'}
                    </Text>
                  </TouchableOpacity>

                  {dueTime && (
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        {
                          borderColor: colors.ghBorder,
                          backgroundColor: 'transparent',
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                        },
                      ]}
                      onPress={() => setDueTime(null)}
                    >
                      <Text style={{ color: colors.ghMuted, fontSize: 12, fontWeight: '600' }}>
                        Clear Time
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ── Reminders (Side by Side layout) ── */}
            {due && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                {/* Start Reminding */}
                <View style={{ flex: 1 }}>
                  <View style={[styles.sectionHeader, { marginTop: 0 }]}>
                    <Feather name="bell" size={13} color={colors.ghMuted} />
                    <Text style={[styles.label, { color: colors.ghMuted, marginTop: 0, marginBottom: 0 }]}>
                      Start Reminding
                    </Text>
                  </View>

                  {availableOffsets.length > 0 ? (
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        {
                          borderColor: colors.ghBorder,
                          backgroundColor: colors.ghBg,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderRadius: 8,
                        },
                      ]}
                      onPress={() => setShowOffsetDropdown(true)}
                    >
                      <Text style={{ color: remindBefore !== null ? colors.ghText : colors.ghMuted, fontSize: 13, fontWeight: '500' }}>
                        {remindBefore !== null ? availableOffsets.find(p => p.value === remindBefore)?.label : 'Select...'}
                      </Text>
                      <Feather name="chevron-down" size={16} color={colors.ghMuted} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.hintText, { color: colors.ghMuted }]}>
                      Due too soon.
                    </Text>
                  )}
                </View>

                {/* Repeat Every */}
                {remindBefore !== null && (
                  <View style={{ flex: 1 }}>
                    <View style={[styles.sectionHeader, { marginTop: 0 }]}>
                      <Feather name="repeat" size={13} color={colors.ghMuted} />
                      <Text style={[styles.label, { color: colors.ghMuted, marginTop: 0, marginBottom: 0 }]}>
                        Repeat Every
                      </Text>
                    </View>

                    {availableRepeatOptions.length > 0 ? (
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          {
                            borderColor: colors.ghBorder,
                            backgroundColor: colors.ghBg,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderRadius: 8,
                          },
                        ]}
                        onPress={() => setShowRepeatDropdown(true)}
                      >
                        <Text style={{ color: repeatEvery !== null ? colors.ghText : colors.ghMuted, fontSize: 13, fontWeight: '500' }}>
                          {repeatEvery !== null ? availableRepeatOptions.find(p => p.value === repeatEvery)?.label : 'Once'}
                        </Text>
                        <Feather name="chevron-down" size={16} color={colors.ghMuted} />
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.hintText, { color: colors.ghMuted }]}>
                        No repeats fit.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}


            {/* ── Total Reminders ── */}
            {due && remindBefore !== null && schedulePreview.length > 0 && (
              <View style={[styles.summaryBox, { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ghBg, borderColor: colors.ghBorder, marginTop: 16 }]}>
                <Feather name="bell" size={14} color={colors.ghBlue} />
                <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>
                  Total Reminders: {totalReminders}
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
                onPress={() => setShowConfirm(true)}
                disabled={!canSubmit}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </RNAnimated.View>
      </KeyboardAvoidingView>
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

    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────



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
