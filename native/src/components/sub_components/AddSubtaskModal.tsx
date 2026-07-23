import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface AddSubtaskModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, description: string) => void;
  colors: any;
}

export default function AddSubtaskModal({ visible, onClose, onAdd, colors }: AddSubtaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!visible) return null;

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), description.trim());
    setTitle('');
    setDescription('');
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
          <Text style={[styles.modalTitle, { color: colors.ghText }]}>Add Subtask</Text>
          
          <Text style={[styles.label, { color: colors.ghMuted }]}>Subtask Title</Text>
          <TextInput
            style={[styles.input, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
            placeholder="e.g. Write tests..."
            placeholderTextColor={colors.ghMuted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, { color: colors.ghMuted, marginTop: 12 }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder, height: 80 }]}
            placeholder="Any extra details..."
            placeholderTextColor={colors.ghMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.ghBorder }]} onPress={handleClose}>
              <Text style={{ color: colors.ghText, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.addBtn, { backgroundColor: title.trim() ? colors.ghBlue : colors.ghSurface2 }]} 
              onPress={handleAdd}
              disabled={!title.trim()}
            >
              <Text style={{ color: title.trim() ? '#fff' : colors.ghMuted, fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
});
