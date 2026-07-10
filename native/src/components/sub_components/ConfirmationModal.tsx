import React, { useRef, useState, useEffect } from "react";
import { View, Text, Modal, StyleSheet, TouchableOpacity, Animated as RNAnimated } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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

  // Reset states when modal is opened/closed
  useEffect(() => {
    if (visible) {
      setIsLoading(false);
      setIsSuccess(false);
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
          // Wait 600ms for premium success animation before closing modal
          setTimeout(() => {
            animateClose(() => {
              onConfirm();
              onClose();
            });
          }, 600);
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
        }, 600);
      }
    } catch (e) {
      console.warn("Authentication error:", e);
      setIsLoading(false);
    }
  };

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
});
