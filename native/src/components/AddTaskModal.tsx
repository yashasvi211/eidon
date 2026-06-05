import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, useColorScheme, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '@/constants/theme';

interface Project {
  name: string;
  color: string;
}

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, project: string, due?: string) => void;
  projects: Project[];
}

export default function AddTaskModal({ visible, onClose, onAdd, projects }: AddTaskModalProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [title, setTitle] = useState('');
  const [project, setProject] = useState('Inbox');
  const [due, setDue] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), project, due.trim() || undefined);
    setTitle('');
    setProject('Inbox');
    setDue('');
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setProject('Inbox');
    setDue('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
          <Text style={[styles.modalTitle, { color: colors.ghText }]}>New Task</Text>

          <Text style={[styles.label, { color: colors.ghMuted }]}>Title</Text>
          <TextInput
            style={[styles.input, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.ghMuted}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          <Text style={[styles.label, { color: colors.ghMuted }]}>Project</Text>
          <View style={styles.projectRow}>
            {projects.map((p) => (
              <TouchableOpacity
                key={p.name}
                style={[
                  styles.projectChip,
                  {
                    borderColor: project === p.name ? p.color : colors.ghBorder,
                    backgroundColor: project === p.name ? p.color + '18' : 'transparent',
                  },
                ]}
                onPress={() => setProject(p.name)}
              >
                <Text style={{ color: project === p.name ? p.color : colors.ghMuted, fontSize: 12, fontWeight: '500' }}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.ghMuted }]}>Due date (optional)</Text>
          <TextInput
            style={[styles.input, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.ghMuted}
            value={due}
            onChangeText={setDue}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { borderColor: colors.ghBorder }]} onPress={handleClose}>
              <Text style={{ color: colors.ghMuted, fontSize: 13, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.primaryBtn, { backgroundColor: colors.ghBlue, borderColor: colors.ghBlue }]}
              onPress={handleSubmit}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  projectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  projectChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtn: {
    borderWidth: 1,
  },
});
