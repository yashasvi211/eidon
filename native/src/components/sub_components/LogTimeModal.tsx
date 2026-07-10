import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated as RNAnimated,
} from "react-native";
import { Feather } from "@expo/vector-icons";

interface LogTimeModalProps {
  visible: boolean;
  onClose: () => void;
  colors: any;
  manualDate: string;
  onOpenCalendar: () => void;
  manualStartTime: string;
  manualEndTime: string;
  onOpenClock: (field: "start" | "end") => void;
  manualNote: string;
  onChangeNote: (text: string) => void;
  addSessionError: string;
  onSave: () => boolean;
  saveSuccess?: boolean;
}

export default function LogTimeModal({
  visible,
  onClose,
  colors,
  manualDate,
  onOpenCalendar,
  manualStartTime,
  manualEndTime,
  onOpenClock,
  manualNote,
  onChangeNote,
  addSessionError,
  onSave,
  saveSuccess = false,
}: LogTimeModalProps) {
  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  // Watch saveSuccess to trigger smooth close
  useEffect(() => {
    if (saveSuccess) {
      animateClose(onClose);
    }
  }, [saveSuccess]);

  useEffect(() => {
    // Keep for any non-animation side-effects if needed in the future
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

  const handleCancel = () => {
    animateClose(onClose);
  };

  const handleSave = () => {
    const success = onSave();
    if (success) {
      animateClose(onClose);
    }
  };

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
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel} onShow={animateOpen}>
      <RNAnimated.View style={[styles.modalOverlayTime, { opacity: opacityAnim }]}>
        <RNAnimated.View
          style={[
            styles.modalContentTime,
            {
              backgroundColor: colors.ghSurface,
              borderColor: colors.ghBorder,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeaderTime}>
            <Text style={[styles.modalTitleTime, { color: colors.ghText }]}>Log Time Entry</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Feather name="x" size={18} color={colors.ghText} />
            </TouchableOpacity>
          </View>

          {/* Date Input */}
          <View style={styles.inputGroupVerticalTime}>
            <Text style={[styles.inputLabelTime, { color: colors.ghMuted }]}>Date (DD/MM/YYYY)</Text>
            <TouchableOpacity
              style={[
                styles.inputTime,
                {
                  backgroundColor: colors.ghBg,
                  borderColor: colors.ghBorder,
                  justifyContent: "center",
                },
              ]}
              onPress={onOpenCalendar}
            >
              <Text style={{ color: colors.ghText, fontSize: 13 }}>{manualDate || "Select Date"}</Text>
            </TouchableOpacity>
          </View>

          {/* Start and End Times side-by-side */}
          <View style={styles.inputRowTime}>
            <View style={styles.inputGroupTime}>
              <Text style={[styles.inputLabelTime, { color: colors.ghMuted }]}>Start (AM/PM)</Text>
              <TouchableOpacity
                style={[
                  styles.inputTime,
                  {
                    backgroundColor: colors.ghBg,
                    borderColor: colors.ghBorder,
                    justifyContent: "center",
                  },
                ]}
                onPress={() => onOpenClock("start")}
              >
                <Text style={{ color: colors.ghText, fontSize: 13 }}>{manualStartTime || "Select Time"}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputGroupTime}>
              <Text style={[styles.inputLabelTime, { color: colors.ghMuted }]}>End (AM/PM)</Text>
              <TouchableOpacity
                style={[
                  styles.inputTime,
                  {
                    backgroundColor: colors.ghBg,
                    borderColor: colors.ghBorder,
                    justifyContent: "center",
                  },
                ]}
                onPress={() => onOpenClock("end")}
              >
                <Text style={{ color: colors.ghText, fontSize: 13 }}>{manualEndTime || "Select Time"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Note Input */}
          <View style={styles.inputGroupVerticalTime}>
            <Text style={[styles.inputLabelTime, { color: colors.ghMuted }]}>Note / Description</Text>
            <TextInput
              style={[
                styles.textAreaTime,
                {
                  color: colors.ghText,
                  backgroundColor: colors.ghBg,
                  borderColor: colors.ghBorder,
                },
              ]}
              value={manualNote}
              onChangeText={onChangeNote}
              placeholder="What did you work on?"
              placeholderTextColor={colors.ghMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Error Message */}
          {addSessionError ? (
            <Text style={[styles.errorTextTime, { color: colors.ghRed }]}>{addSessionError}</Text>
          ) : null}

          {/* Actions */}
          <View style={styles.modalFooterTime}>
            <TouchableOpacity
              style={[styles.btnTime, { borderColor: colors.ghBorder, backgroundColor: colors.ghSurface2 }]}
              onPress={handleCancel}
            >
              <Text style={[styles.btnTextTime, { color: colors.ghText }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnTime, { backgroundColor: colors.ghBlue, borderColor: colors.ghBlue }]}
              onPress={handleSave}
            >
              <Text style={[styles.btnTextTime, { color: "#ffffff" }]}>Save Entry</Text>
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
  modalContentTime: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  modalHeaderTime: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitleTime: {
    fontSize: 16,
    fontWeight: "700",
  },
  inputGroupVerticalTime: {
    marginBottom: 16,
  },
  inputLabelTime: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputTime: {
    borderWidth: 1,
    borderRadius: 6,
    height: 40,
    paddingHorizontal: 12,
  },
  inputRowTime: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  inputGroupTime: {
    flex: 1,
  },
  textAreaTime: {
    borderWidth: 1,
    borderRadius: 6,
    height: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlignVertical: "top",
    fontSize: 13,
  },
  errorTextTime: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 16,
  },
  modalFooterTime: {
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
