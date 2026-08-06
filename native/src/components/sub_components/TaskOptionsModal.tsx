import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface TaskOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  colors: any;
}

export default function TaskOptionsModal({
  visible,
  onClose,
  onUpdate,
  onDelete,
  onToggleMute,
  isMuted,
  colors,
}: TaskOptionsModalProps) {
  // Always keep <Modal> mounted and drive visibility with the `visible` prop.
  // Returning null when hidden unmounts the native modal and makes re-open flaky
  // (especially after open → close → open).
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop — tap outside sheet to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.ghBorder2 || colors.ghBorder }]} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>Task Options</Text>

          {/* Update Card */}
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
            onPress={onUpdate}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.ghBlue + '18' }]}>
              <Feather name="edit-2" size={18} color={colors.ghBlue} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.ghText }]}>Update Task</Text>
              <Text style={[styles.cardSub, { color: colors.ghMuted }]}>Edit task details</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.ghMuted} />
          </TouchableOpacity>

          {/* Mute / Unmute Card */}
          <TouchableOpacity
            style={[styles.card, {
              backgroundColor: isMuted ? 'rgba(88,166,255,0.05)' : colors.ghBg,
              borderColor: isMuted ? 'rgba(88,166,255,0.3)' : colors.ghBorder,
            }]}
            onPress={onToggleMute}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: isMuted ? 'rgba(88,166,255,0.15)' : colors.ghBorder + '44' }]}>
              <Feather name={isMuted ? 'bell' : 'bell-off'} size={18} color={isMuted ? colors.ghBlue : colors.ghMuted} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: isMuted ? colors.ghBlue : colors.ghText }]}>
                {isMuted ? 'Unmute Task' : 'Mute Task'}
              </Text>
              <Text style={[styles.cardSub, { color: colors.ghMuted }]}>
                {isMuted ? 'Re-enable notifications' : 'Silence all notifications'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.ghMuted} />
          </TouchableOpacity>

          {/* Delete Card */}
          <TouchableOpacity
            style={[styles.card, { backgroundColor: 'rgba(248,81,73,0.05)', borderColor: 'rgba(248,81,73,0.25)' }]}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(248,81,73,0.15)' }]}>
              <Feather name="trash-2" size={18} color="#f85149" />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: '#f85149' }]}>Delete Task</Text>
              <Text style={[styles.cardSub, { color: 'rgba(248,81,73,0.7)' }]}>Move to trash</Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(248,81,73,0.5)" />
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.ghBorder }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: colors.ghMuted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
  },
  cancelBtn: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
