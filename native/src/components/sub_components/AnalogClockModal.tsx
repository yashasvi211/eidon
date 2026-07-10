import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated as RNAnimated,
} from "react-native";

interface AnalogClockModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTime: (timeStr: string) => void;
  initialTimeStr: string;
  colors: any;
  title: string;
}

export default function AnalogClockModal({ visible, onClose, onSelectTime, initialTimeStr, colors, title }: AnalogClockModalProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmPm] = useState<"AM" | "PM">("AM");
  const [mode, setMode] = useState<"hour" | "minute">("hour");

  const [isDragging, setIsDragging] = useState(false);
  const [dragAngle, setDragAngle] = useState(0);

  // Animation values
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

      if (initialTimeStr) {
        const parsed = parseInitTime(initialTimeStr);
        setHour(parsed.hour);
        setMinute(parsed.minute);
        setAmPm(parsed.ampm);
        setMode("hour");
      }
    }
  }, [visible, initialTimeStr]);

  const parseInitTime = (str: string) => {
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const match = str.match(timeRegex);
    if (match) {
      return {
        hour: Number(match[1]),
        minute: Number(match[2]),
        ampm: match[3].toUpperCase() as "AM" | "PM",
      };
    }
    return { hour: 9, minute: 0, ampm: "AM" as const };
  };

  const handleClockInteraction = (x: number, y: number) => {
    const dx = x - 100;
    const dy = y - 100;
    const angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180) / Math.PI;
    let clockAngle = (angleDeg + 90) % 360;
    if (clockAngle < 0) clockAngle += 360;

    // Set smooth rotation angle
    setDragAngle(clockAngle);

    if (mode === "hour") {
      let h = Math.round(clockAngle / 30);
      if (h === 0) h = 12;
      setHour(h);
    } else {
      let m = Math.round(clockAngle / 6) % 60;
      setMinute(m);
    }
  };

  const handleClockTouch = (event: any) => {
    setIsDragging(true);
    const { locationX, locationY } = event.nativeEvent;
    handleClockInteraction(locationX, locationY);
  };

  const handleClockTouchMove = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    handleClockInteraction(locationX, locationY);
  };

  const handleClockTouchEnd = () => {
    setIsDragging(false);
    if (mode === "hour") {
      setMode("minute");
    }
  };

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

  const handleSave = () => {
    const hrStr = String(hour).padStart(2, "0");
    const minStr = String(minute).padStart(2, "0");
    animateClose(() => {
      onSelectTime(`${hrStr}:${minStr} ${ampm}`);
      onClose();
    });
  };

  const handAngle = isDragging
    ? dragAngle
    : mode === "hour"
    ? hour * 30
    : minute * 6;

  const handAngleRad = ((handAngle - 90) * Math.PI) / 180;
  const handX = 100 + 72 * Math.cos(handAngleRad);
  const handY = 100 + 72 * Math.sin(handAngleRad);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => animateClose(onClose)}>
      <View style={styles.modalOverlayTime}>
        <RNAnimated.View
          style={[
            styles.clockModalContent,
            {
              backgroundColor: colors.ghSurface,
              borderColor: colors.ghBorder,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
              alignItems: "center",
            },
          ]}
        >
          {/* Header Title */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.ghMuted, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {title}
          </Text>

          {/* Large Time Display Header */}
          <View style={styles.clockHeader}>
            <View style={styles.clockHeaderTimeRow}>
              <TouchableOpacity onPress={() => setMode("hour")}>
                <Text style={[styles.clockHeaderText, mode === "hour" ? { color: colors.ghBlue } : { color: colors.ghMuted }]}>
                  {String(hour).padStart(2, "0")}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.clockHeaderText, { color: colors.ghMuted }]}>:</Text>
              <TouchableOpacity onPress={() => setMode("minute")}>
                <Text style={[styles.clockHeaderText, mode === "minute" ? { color: colors.ghBlue } : { color: colors.ghMuted }]}>
                  {String(minute).padStart(2, "0")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.clockAmPmCol}>
              <TouchableOpacity onPress={() => setAmPm("AM")} style={[styles.ampmBtn, ampm === "AM" && { backgroundColor: colors.ghSurface2, borderRadius: 4 }]}>
                <Text style={[styles.ampmBtnText, { color: ampm === "AM" ? colors.ghText : colors.ghMuted }]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAmPm("PM")} style={[styles.ampmBtn, ampm === "PM" && { backgroundColor: colors.ghSurface2, borderRadius: 4 }]}>
                <Text style={[styles.ampmBtnText, { color: ampm === "PM" ? colors.ghText : colors.ghMuted }]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Clock Face Selector */}
          <View
            style={[styles.clockFace, { backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
            onTouchStart={handleClockTouch}
            onTouchMove={handleClockTouchMove}
            onTouchEnd={handleClockTouchEnd}
          >
            {/* Center point */}
            <View pointerEvents="none" style={[styles.clockCenter, { backgroundColor: colors.ghBlue }]} />

            {/* Selection line */}
            <View
              pointerEvents="none"
              style={[
                styles.clockHand,
                {
                  backgroundColor: colors.ghBlue,
                  transform: [
                    { translateY: 36 },
                    { rotate: `${handAngle}deg` },
                    { translateY: -36 },
                  ],
                },
              ]}
            />

            {/* Selected point circle */}
            <View pointerEvents="none" style={[styles.clockHandCircle, { left: handX - 14, top: handY - 14, backgroundColor: colors.ghBlue }]} />

            {/* Numbers */}
            {Array.from({ length: 12 }).map((_, i) => {
              const num = i + 1;
              const displayVal = mode === "hour" ? num : String((num * 5) % 60).padStart(2, "0");
              const angleRad = ((num * 30 - 90) * Math.PI) / 180;
              const x = 100 + 72 * Math.cos(angleRad) - 10;
              const y = 100 + 72 * Math.sin(angleRad) - 10;
              const isSelected = mode === "hour" ? hour === num : minute === (num * 5) % 60;

              return (
                <View key={i} pointerEvents="none" style={[styles.clockNumberBox, { left: x, top: y }]}>
                  <Text
                    style={[
                      styles.clockNumberText,
                      { color: isSelected ? "#ffffff" : colors.ghText },
                      isSelected && { fontWeight: "700" },
                    ]}
                  >
                    {displayVal}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Footer Actions */}
          <View style={styles.clockFooter}>
            <TouchableOpacity style={[styles.btnTime, { borderColor: colors.ghBorder, backgroundColor: colors.ghSurface2 }]} onPress={() => animateClose(onClose)}>
              <Text style={[styles.btnTextTime, { color: colors.ghText }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnTime, { backgroundColor: colors.ghBlue, borderColor: colors.ghBlue }]} onPress={handleSave}>
              <Text style={[styles.btnTextTime, { color: "#ffffff" }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </RNAnimated.View>
      </View>
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
  clockModalContent: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  clockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
  },
  clockHeaderTimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clockHeaderText: {
    fontSize: 32,
    fontWeight: "700",
  },
  clockAmPmCol: {
    flexDirection: "column",
    gap: 4,
  },
  ampmBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ampmBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  clockFace: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    position: "relative",
    marginBottom: 20,
  },
  clockCenter: {
    position: "absolute",
    left: 97,
    top: 97,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  clockHand: {
    position: "absolute",
    left: 99,
    top: 28,
    width: 2,
    height: 72,
  },
  clockHandCircle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.4,
  },
  clockNumberBox: {
    position: "absolute",
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clockNumberText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  clockFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    width: "100%",
  },
  btnTime: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  btnTextTime: {
    fontSize: 13,
    fontWeight: "600",
  },
});
