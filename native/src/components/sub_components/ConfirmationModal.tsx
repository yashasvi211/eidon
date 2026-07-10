import React, { useRef, useState, useEffect } from "react";
import { View, Text, Modal, StyleSheet, TouchableOpacity, Animated as RNAnimated } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import SwipeButton from "./SwipeButton";

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  colors: any;
}

export default function ConfirmationModal({ visible, onClose, onConfirm, title, description, colors }: ConfirmationModalProps) {
  const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const successProgress = useSharedValue(0);

  // Reset states when modal is opened/closed
  useEffect(() => {
    if (visible) {
      setIsLoading(false);
      setIsSuccess(false);
      successProgress.value = 0;
    }
  }, [visible]);

  // Spring checkmark animation on success
  useEffect(() => {
    if (isSuccess) {
      successProgress.value = withSpring(1, { damping: 18, stiffness: 45, mass: 1.2 });
    }
  }, [isSuccess]);

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

  const handleSwipeSuccess = async () => {
    setIsLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to Confirm",
          fallbackLabel: "Use PIN",
        });

        if (authResult.success) {
          setIsLoading(false);
          setIsSuccess(true);
          // Wait 1800ms for premium success animation before closing modal
          setTimeout(() => {
            animateClose(() => {
              onConfirm();
              onClose();
            });
          }, 1800);
        } else {
          setIsLoading(false);
        }
      } else {
        // Fallback if no auth enrolled
        setIsLoading(false);
        setIsSuccess(true);
        setTimeout(() => {
          animateClose(() => {
            onConfirm();
            onClose();
          });
        }, 1800);
      }
    } catch (e) {
      console.warn("Authentication error:", e);
      setIsLoading(false);
    }
  };

  // Reanimated style definitions (smoothed and slowed down)
  const successOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(successProgress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  const rippleStyle1 = useAnimatedStyle(() => {
    const scale = interpolate(successProgress.value, [0.1, 1], [0.8, 1.6], Extrapolation.CLAMP);
    const opacity = interpolate(successProgress.value, [0.1, 0.7, 1], [0, 0.5, 0], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const rippleStyle2 = useAnimatedStyle(() => {
    const scale = interpolate(successProgress.value, [0.3, 1], [0.8, 2.0], Extrapolation.CLAMP);
    const opacity = interpolate(successProgress.value, [0.3, 0.8, 1], [0, 0.4, 0], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const successCircleStyle = useAnimatedStyle(() => {
    // Zoom out from the exact size and position of the Swipe Button thumb (bottom-right corner)
    const scale = interpolate(successProgress.value, [0, 0.85, 1], [0.58, 1.05, 1], Extrapolation.CLAMP);
    const translateX = interpolate(successProgress.value, [0, 1], [117, 0], Extrapolation.CLAMP);
    const translateY = interpolate(successProgress.value, [0, 1], [25, 0], Extrapolation.CLAMP);
    const rotate = interpolate(successProgress.value, [0, 1], [-30, 0], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const successLabelStyle = useAnimatedStyle(() => {
    const opacity = interpolate(successProgress.value, [0.55, 1], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(successProgress.value, [0.55, 1], [12, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      opacity: isSuccess ? withTiming(0, { duration: 100 }) : 1,
    };
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => animateClose(onClose)} onShow={animateOpen}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RNAnimated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
          <RNAnimated.View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.ghSurface,
                borderColor: colors.ghBorder,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Animated.View style={contentStyle}>
              <Text style={[styles.title, { color: colors.ghText }]}>{title}</Text>
              <Text style={[styles.description, { color: colors.ghMuted }]}>{description}</Text>

              <View style={styles.actionContainer}>
                <SwipeButton
                  text="Swipe to Confirm"
                  onSwipeSuccess={handleSwipeSuccess}
                  colors={colors}
                  isLoading={isLoading}
                  isSuccess={isSuccess}
                />
              </View>
              
              <TouchableOpacity 
                disabled={isLoading || isSuccess}
                style={[
                  styles.cancelBtn, 
                  { 
                    borderColor: colors.ghBorder, 
                    backgroundColor: colors.ghSurface2,
                    opacity: (isLoading || isSuccess) ? 0.5 : 1
                  }
                ]} 
                onPress={() => animateClose(onClose)}
              >
                <Text style={{ color: colors.ghText, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Premium Full-Modal Success Overlay */}
            {isSuccess && (
              <Animated.View style={[styles.successOverlay, { backgroundColor: colors.ghSurface }, successOverlayStyle]}>
                <View style={styles.rippleContainer}>
                  <Animated.View style={[styles.rippleRing, rippleStyle1]} />
                  <Animated.View style={[styles.rippleRing, rippleStyle2]} />
                  <Animated.View style={[styles.successCircle, successCircleStyle]}>
                    <Feather name="check" size={38} color="#ffffff" />
                  </Animated.View>
                </View>

                <Animated.Text style={[styles.successLabel, { color: colors.ghText }, successLabelStyle]}>
                  Time Logged Successfully!
                </Animated.Text>
              </Animated.View>
            )}
          </RNAnimated.View>
        </RNAnimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  actionContainer: {
    marginBottom: 16,
  },
  cancelBtn: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    padding: 20,
  },
  rippleContainer: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#3fb950",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3fb950",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 2,
  },
  rippleRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "#3fb950",
    zIndex: 1,
  },
  successLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
});
