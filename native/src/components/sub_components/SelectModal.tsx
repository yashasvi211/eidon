import React, { useRef, useEffect, useState } from 'react';
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
  const [tempValue, setTempValue] = useState<number | null>(selectedValue);
  const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setTempValue(selectedValue);
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
  }, [visible, selectedValue]);

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
    setTempValue(val);
  };

  const handleConfirm = () => {
    if (tempValue !== null) {
      onSelect(tempValue);
    }
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
          </View>
          <ScrollView style={{ maxHeight: 300, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const active = tempValue === opt.value;
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
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleClose} style={[styles.btn, { borderColor: colors.ghBorder }]}>
              <Text style={{ color: colors.ghMuted, fontSize: 13, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={[styles.btn, { backgroundColor: colors.ghBlue, borderColor: colors.ghBlue }]}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>OK</Text>
            </TouchableOpacity>
          </View>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
});
