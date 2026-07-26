import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tracker, TrackerFrequency, TrackerValueType } from '../types/tracking';
import { Colors } from '../constants/theme';

interface AddTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (tracker: Tracker) => void;
}

const EMOJIS = ['📚','🏋️','🎬','🪢','⚖️','🏃','💊','🎸','✍️','🧘','🍎','💻','🎯','🌟','💰','🚗','✈️','🎨','🏊','📝'];
const CURATED_COLORS = ['#bc8cff', '#3fb950', '#e3b341', '#58a6ff', '#ff7b72', '#ec6547', '#9e6a03', '#d2a8ff'];

export default function AddTrackerModal({ visible, onClose, onAdd }: AddTrackerModalProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🌟');
  const [valueType, setValueType] = useState<TrackerValueType>('count');
  const [unit, setUnit] = useState('');
  const [frequency, setFrequency] = useState<TrackerFrequency>('daily');
  const [color, setColor] = useState(CURATED_COLORS[0]);

  const handleSave = () => {
    if (!name.trim()) return;

    const newTracker: Tracker = {
      id: `t_${Date.now()}`,
      name: name.trim(),
      emoji,
      unit: unit.trim() || (valueType === 'duration' ? 'hours' : 'count'),
      valueType,
      frequency,
      color,
      createdAt: Date.now(),
      entries: []
    };

    onAdd(newTracker);
    
    // Reset state
    setName('');
    setEmoji('🌟');
    setValueType('count');
    setUnit('');
    setFrequency('daily');
    setColor(CURATED_COLORS[0]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background, borderColor: colors.ghBorder }]}>
          <View style={[styles.header, { borderBottomColor: colors.ghBorder }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>New Tracker</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={[styles.label, { color: colors.text }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.ghBorder }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Reading, Weight"
              placeholderTextColor={colors.ghMuted}
            />

            <Text style={[styles.label, { color: colors.text }]}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, emoji === e && { backgroundColor: hexToRgba(color, 0.2), borderColor: color }]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Value Type</Text>
            <View style={styles.segmentContainer}>
              {(['count', 'duration', 'decimal'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.segmentBtn,
                    { borderColor: colors.ghBorder },
                    valueType === type && { backgroundColor: color, borderColor: color }
                  ]}
                  onPress={() => setValueType(type)}
                >
                  <Text style={[styles.segmentText, { color: valueType === type ? '#fff' : colors.text }]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Unit Label</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.ghBorder }]}
              value={unit}
              onChangeText={setUnit}
              placeholder={valueType === 'duration' ? 'e.g. hours' : valueType === 'decimal' ? 'e.g. kg' : 'e.g. books'}
              placeholderTextColor={colors.ghMuted}
            />

            <Text style={[styles.label, { color: colors.text }]}>Frequency</Text>
            <View style={styles.segmentContainer}>
              {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.segmentBtn,
                    { borderColor: colors.ghBorder },
                    frequency === freq && { backgroundColor: color, borderColor: color }
                  ]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text style={[styles.segmentText, { color: frequency === freq ? '#fff' : colors.text }]}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Color</Text>
            <View style={styles.colorGrid}>
              {CURATED_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorBtn,
                    { backgroundColor: c },
                    color === c && styles.colorBtnSelected
                  ]}
                  onPress={() => setColor(c)}
                >
                  {color === c && <Feather name="check" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Create Tracker</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function hexToRgba(hex: string, alpha: number) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  body: { padding: 16 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiText: { fontSize: 24 },
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: { fontWeight: '600' },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorBtnSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  saveBtn: {
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
