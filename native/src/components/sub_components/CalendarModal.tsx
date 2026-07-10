import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated as RNAnimated,
} from "react-native";
import { Feather } from "@expo/vector-icons";

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  initialDateStr: string;
  colors: any;
}

export default function CalendarModal({ visible, onClose, onSelectDate, initialDateStr, colors }: CalendarModalProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible && initialDateStr) {
      const parts = initialDateStr.split("/");
      if (parts.length === 3) {
        const d = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const y = Number(parts[2]);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const parsedDate = new Date(y, m, d);
          setViewDate(parsedDate);
          setSelectedDate(parsedDate);
        }
      }
    }
  }, [visible, initialDateStr]);

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
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    const totalDays = 42;
    const remainingDays = totalDays - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewDate]);

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < calendarData.length; i += 7) {
      w.push(calendarData.slice(i, i + 7));
    }
    return w;
  }, [calendarData]);

  const handlePrev = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNext = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

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

  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSave = () => {
    if (selectedDate) {
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const year = selectedDate.getFullYear();
      animateClose(() => {
        onSelectDate(`${day}/${month}/${year}`);
        onClose();
      });
    } else {
      animateClose(onClose);
    }
  };

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const animateOpen = () => {
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
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => animateClose(onClose)} onShow={animateOpen}>
      <RNAnimated.View style={[styles.modalOverlayTime, { opacity: opacityAnim }]}>
        <RNAnimated.View
          style={[
            styles.calendarModalContent,
            {
              backgroundColor: colors.ghSurface,
              borderColor: colors.ghBorder,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.ghMuted, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5, textAlign: 'center' }}>
            Select Date
          </Text>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={handlePrev} style={styles.calNavBtn}>
              <Feather name="chevron-left" size={18} color={colors.ghText} />
            </TouchableOpacity>
            <Text style={[styles.calendarTitle, { color: colors.ghText }]}>{monthLabel}</Text>
            <TouchableOpacity onPress={handleNext} style={styles.calNavBtn}>
              <Feather name="chevron-right" size={18} color={colors.ghText} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdaysRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text key={i} style={[styles.weekdayText, { color: colors.ghMuted }]}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wIdx) => (
            <View key={wIdx} style={{ flexDirection: "row", marginBottom: 4 }}>
              {week.map((day, dIdx) => {
                const isSelected = selectedDate ? (
                  day.date.getDate() === selectedDate.getDate() &&
                  day.date.getMonth() === selectedDate.getMonth() &&
                  day.date.getFullYear() === selectedDate.getFullYear()
                ) : false;
                return (
                  <TouchableOpacity
                    key={dIdx}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: colors.ghBlue, borderRadius: 18 },
                    ]}
                    onPress={() => handleSelectDay(day.date)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: isSelected ? "#ffffff" : day.isCurrentMonth ? colors.ghText : colors.ghMuted },
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Footer Actions */}
          <View style={[styles.calendarFooter, { borderColor: colors.ghBorder }]}>
            <TouchableOpacity style={[styles.btnTime, { borderColor: colors.ghBorder, backgroundColor: colors.ghSurface2 }]} onPress={() => animateClose(onClose)}>
              <Text style={[styles.btnTextTime, { color: colors.ghText }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnTime, { backgroundColor: colors.ghBlue, borderColor: colors.ghBlue }]} onPress={handleSave}>
              <Text style={[styles.btnTextTime, { color: "#ffffff" }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </RNAnimated.View>
      </RNAnimated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlayTime: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarModalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  calNavBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdaysRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  dayCell: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  calendarFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 16,
    borderColor: 'transparent',
  },
  btnTime: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  btnTextTime: {
    fontSize: 14,
    fontWeight: "600",
  },
});
