import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated as RNAnimated,
} from "react-native";
import * as Haptics from "expo-haptics";

interface AnalogClockModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTime: (timeStr: string) => void;
  initialTimeStr: string;
  colors: any;
  title: string;
}

interface ScrollWheelProps {
  items: string[];
  selectedValue: string;
  onValueChange: (val: string) => void;
  colors: any;
  visible: boolean;
}

function ScrollWheel({ items, selectedValue, onValueChange, colors, visible }: ScrollWheelProps) {
  const itemHeight = 44; // slightly taller for better centering room
  const listHeight = itemHeight * 3; // shows 3 items
  const activeIndex = items.indexOf(selectedValue);
  const scrollY = useRef(new RNAnimated.Value(activeIndex !== -1 ? activeIndex * itemHeight : 0)).current;
  const flatListRef = useRef<any>(null);
  const lastHapticIndex = useRef(activeIndex);

  // Trigger haptics when crossing item boundaries during scroll
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const idx = Math.round(value / itemHeight);
      if (idx !== lastHapticIndex.current && idx >= 0 && idx < items.length) {
        if (lastHapticIndex.current !== -1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        lastHapticIndex.current = idx;
      }
    });
    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [items.length, itemHeight]);



  // After momentum/snap settles, just update state
  const handleMomentumEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    const val = items[clampedIndex];
    if (val !== selectedValue) {
      onValueChange(val);
    }
  };

  return (
    <View style={[styles.wheelContainer, { height: listHeight }]}>
      {/* Highlight bar behind the center item */}
      <View
        style={[
          styles.wheelHighlight,
          {
            top: itemHeight,
            height: itemHeight,
            borderColor: colors.ghBorder,
            backgroundColor: colors.ghSurface2,
          },
        ]}
        pointerEvents="none"
      />

      <RNAnimated.FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToOffsets={items.map((_, i) => i * itemHeight)}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingVertical: itemHeight,
        }}
        getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
        initialScrollIndex={activeIndex !== -1 ? activeIndex : undefined}
        initialNumToRender={5}
        windowSize={5}
        maxToRenderPerBatch={10}
        renderItem={({ item, index: idx }) => {
          const inputRange = [
            (idx - 1) * itemHeight,
            idx * itemHeight,
            (idx + 1) * itemHeight,
          ];

          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.78, 1.08, 0.78],
            extrapolate: "clamp",
          });

          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.3, 1.0, 0.3],
            extrapolate: "clamp",
          });

          const isSelected = idx === activeIndex;

          return (
            <RNAnimated.View
              style={[
                styles.wheelItem,
                {
                  height: itemHeight,
                  transform: [{ scale }],
                  opacity,
                },
              ]}
            >
              <Text
                style={[
                  styles.wheelItemText,
                  {
                    color: isSelected ? colors.ghBlue : colors.ghText,
                    fontWeight: isSelected ? "700" : "400",
                  },
                ]}
              >
                {item as string}
              </Text>
            </RNAnimated.View>
          );
        }}
      />
    </View>
  );
}

export default function AnalogClockModal({ visible, onClose, onSelectTime, initialTimeStr, colors, title }: AnalogClockModalProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmPm] = useState<"AM" | "PM">("AM");

  // Animation values
  const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  // Generate lists
  const hoursArray = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")), []);
  const minutesArray = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);

  useEffect(() => {
    if (visible && initialTimeStr) {
      const parsed = parseInitTime(initialTimeStr);
      setHour(parsed.hour);
      setMinute(parsed.minute);
      setAmPm(parsed.ampm);
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
            styles.clockModalContent,
            {
              backgroundColor: colors.ghSurface,
              borderColor: colors.ghBorder,
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
              <Text style={[styles.clockHeaderText, { color: colors.ghBlue }]}>
                {String(hour).padStart(2, "0")}
              </Text>
              <Text style={[styles.clockHeaderText, { color: colors.ghMuted, marginHorizontal: 4 }]}>:</Text>
              <Text style={[styles.clockHeaderText, { color: colors.ghBlue }]}>
                {String(minute).padStart(2, "0")}
              </Text>
              <Text style={[styles.ampmText, { color: colors.ghText, marginLeft: 10 }]}>
                {ampm}
              </Text>
            </View>
          </View>

          {/* iOS Style Drum Wheel Picker Row */}
          <View style={styles.pickerRow}>
            <ScrollWheel
              items={hoursArray}
              selectedValue={String(hour).padStart(2, "0")}
              onValueChange={(val) => setHour(Number(val))}
              colors={colors}
              visible={visible}
            />
            <Text style={[styles.separator, { color: colors.ghMuted }]}>:</Text>
            <ScrollWheel
              items={minutesArray}
              selectedValue={String(minute).padStart(2, "0")}
              onValueChange={(val) => setMinute(Number(val))}
              colors={colors}
              visible={visible}
            />
            <ScrollWheel
              items={["AM", "PM"]}
              selectedValue={ampm}
              onValueChange={(val) => setAmPm(val as "AM" | "PM")}
              colors={colors}
              visible={visible}
            />
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
  clockModalContent: {
    width: "100%",
    maxWidth: 290,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  clockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  clockHeaderTimeRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  clockHeaderText: {
    fontSize: 34,
    fontWeight: "700",
  },
  ampmText: {
    fontSize: 18,
    fontWeight: "600",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    gap: 8,
    width: "100%",
  },
  wheelContainer: {
    width: 68,
    position: "relative",
    overflow: "hidden",
  },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
  },
  wheelItem: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  wheelItemText: {
    fontSize: 17,
  },
  separator: {
    fontSize: 18,
    fontWeight: "700",
  },
  clockFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    width: "100%",
    marginTop: 20,
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
