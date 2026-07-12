import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Animated as RNAnimated } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SelectModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { label: string; value: number }[];
  selectedValue: number | null;
  onSelect: (value: number) => void;
  colors: any;
}

export default function SelectModal({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  colors,
}: SelectModalProps) {
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

  const handleClose = () => {
    animateClose(onClose);
  };

  const handleSelect = (val: number) => {
    onSelect(val);
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <RNAnimated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <RNAnimated.View
          style={[
            styles.modal,
            {
              backgroundColor: colors.ghSurface,
              borderColor: colors.ghBorder,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.ghText }}>{title}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Feather name="x" size={20} color={colors.ghMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const active = selectedValue === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionRow,
                    {
                      borderBottomColor: colors.ghBorder,
                      backgroundColor: active ? colors.ghBlue + '18' : 'transparent',
                    }
                  ]}
                  onPress={() => handleSelect(opt.value)}
                >
                  <Text style={{ color: active ? colors.ghBlue : colors.ghText, fontSize: 15, fontWeight: '500' }}>
                    {opt.label}
                  </Text>
                  {active && <Feather name="check" size={16} color={colors.ghBlue} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </RNAnimated.View>
      </RNAnimated.View>
    </Modal>
  );
}

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
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
