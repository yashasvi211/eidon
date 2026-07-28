import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated as RNAnimated,
} from "react-native";
import * as Haptics from "expo-haptics";

interface DurationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDuration: (durationStr: string) => void;
  initialDurationStr: string; // e.g. "1h 30m"
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
  const itemHeight = 44;
  const listHeight = itemHeight * 3;
  const activeIndex = items.indexOf(selectedValue);
  const scrollY = useRef(new RNAnimated.Value(activeIndex !== -1 ? activeIndex * itemHeight : 0)).current;
  const flatListRef = useRef<any>(null);
  const lastHapticIndex = useRef(activeIndex);

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

export default function DurationPickerModal({ visible, onClose, onSelectDuration, initialDurationStr, colors, title }: DurationPickerModalProps) {
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);

  const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  const hoursArray = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutesArray = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);

  useEffect(() => {
    if (visible && initialDurationStr) {
      const parsed = parseInitDuration(initialDurationStr);
      setHour(parsed.hour);
      setMinute(parsed.minute);
    } else if (visible && !initialDurationStr) {
      setHour(0);
      setMinute(15);
    }
  }, [visible, initialDurationStr]);

  const parseInitDuration = (str: string) => {
    let h = 0;
    let m = 0;
    const hMatch = str.match(/(\d+)h/);
    if (hMatch) h = parseInt(hMatch[1], 10);
    const mMatch = str.match(/(\d+)m/);
    if (mMatch) m = parseInt(mMatch[1], 10);
    return { hour: h, minute: m };
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
    let dur = "";
    if (hour > 0) dur += `${hour}h `;
    if (minute > 0) dur += `${minute}m`;
    if (dur.trim() === "") dur = "0m";
    animateClose(() => {
      onSelectDuration(dur.trim());
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
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.ghMuted, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {title}
          </Text>

          <View style={styles.clockHeader}>
            <View style={styles.clockHeaderTimeRow}>
              <Text style={[styles.clockHeaderText, { color: colors.ghBlue }]}>
                {String(hour).padStart(2, "0")}
              </Text>
              <Text style={[styles.ampmText, { color: colors.ghText, marginLeft: 4, marginRight: 10 }]}>h</Text>
              <Text style={[styles.clockHeaderText, { color: colors.ghBlue }]}>
                {String(minute).padStart(2, "0")}
              </Text>
              <Text style={[styles.ampmText, { color: colors.ghText, marginLeft: 4 }]}>m</Text>
            </View>
          </View>

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
          </View>

          <View style={styles.clockFooter}>
            <TouchableOpacity style={[styles.btnTime, { borderColor: colors.ghBorder }]} onPress={() => animateClose(onClose)}>
              <Text style={{ color: colors.ghMuted, fontSize: 13, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.btnTime, 
                { 
                  backgroundColor: colors.ghBlue, 
                  borderColor: colors.ghBlue 
                }
              ]} 
              onPress={handleSave}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: '600' }}>OK</Text>
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
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
