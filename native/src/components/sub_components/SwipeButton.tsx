import React, { useState, useEffect } from "react";
import { StyleSheet, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";

interface SwipeButtonProps {
  text: string;
  onSwipeSuccess: () => void;
  colors: any;
  disabled?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
}

const SNAP_SPRING = { damping: 24, stiffness: 300, mass: 0.7 };

export default function SwipeButton({
  text,
  onSwipeSuccess,
  colors,
  disabled = false,
  isLoading = false,
  isSuccess = false,
}: SwipeButtonProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const thumbWidth = 46;

  const onLayout = (e: any) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const panGesture = Gesture.Pan()
    .enabled(!disabled && !isLoading && !isSuccess)
    .activeOffsetX([5, -5])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      const maxTranslate = Math.max(0, trackWidth - thumbWidth - 4);
      translateX.value = Math.max(
        0,
        Math.min(event.translationX, maxTranslate)
      );
    })
    .onEnd(() => {
      const maxTranslate = Math.max(0, trackWidth - thumbWidth - 4);
      if (translateX.value > maxTranslate * 0.8) {
        translateX.value = withSpring(maxTranslate, SNAP_SPRING, (finished) => {
          if (finished) {
            runOnJS(onSwipeSuccess)();
          }
        });
      } else {
        translateX.value = withSpring(0, SNAP_SPRING);
      }
    });

  // Watch for reset or loading states
  useEffect(() => {
    if (!isLoading && !isSuccess) {
      translateX.value = withTiming(0, { duration: 250 });
    } else {
      const maxTranslate = Math.max(0, trackWidth - thumbWidth - 4);
      if (maxTranslate > 0) {
        translateX.value = withSpring(maxTranslate, SNAP_SPRING);
      }
    }
  }, [isLoading, isSuccess, trackWidth]);

  const animatedThumbStyle = useAnimatedStyle(() => {
    const thumbBg = isSuccess
      ? withSpring("#3fb950")
      : withSpring(colors.ghBlue);

    return {
      transform: [{ translateX: translateX.value }],
      backgroundColor: thumbBg,
    };
  });

  const animatedTrackStyle = useAnimatedStyle(() => {
    const maxTranslate = Math.max(1, trackWidth - thumbWidth - 4);
    const targetOpacity = (isLoading || isSuccess) ? 0 : interpolate(
      translateX.value,
      [0, maxTranslate * 0.6],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: withTiming(targetOpacity, { duration: 150 }),
    };
  });

  const animatedTrackBgStyle = useAnimatedStyle(() => {
    const bg = isSuccess
      ? withTiming("rgba(63, 185, 80, 0.15)", { duration: 200 })
      : withTiming(colors.ghSurface2, { duration: 200 });
    return {
      backgroundColor: bg,
    };
  });

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.swipeTrack,
        {
          borderColor: isSuccess ? "#3fb950" : colors.ghBorder,
          opacity: disabled ? 0.5 : 1,
        },
        animatedTrackBgStyle,
      ]}
    >
      <Animated.Text
        style={[
          styles.swipeText,
          { color: colors.ghMuted },
          animatedTrackStyle,
        ]}
      >
        {text}
      </Animated.Text>

      {isSuccess && (
        <Animated.Text
          style={[
            styles.swipeSuccessText,
            { color: "#3fb950" },
          ]}
        >
          Completed
        </Animated.Text>
      )}

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.swipeThumb,
            animatedThumbStyle,
          ]}
        >
          {isSuccess ? (
            <Feather name="check" size={20} color="#ffffff" />
          ) : isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Feather name="chevrons-right" size={20} color="#ffffff" />
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipeTrack: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    marginTop: 8,
  },
  swipeText: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  swipeSuccessText: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  swipeThumb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    left: 2,
    top: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
});
