import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, useColorScheme, Modal, Switch } from 'react-native';
import { Colors } from '../constants/theme';
import { Task } from './DetailPanel';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

interface Project {
  name: string;
  color: string;
}

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentProject: string | null;
  setCurrentProject: (project: string | null) => void;
  projects: Project[];
  onAddProject: (name: string, color: string) => void;
  tasks: Task[];
  isSleeping: boolean;
  setIsSleeping: (val: boolean) => void;
  onOpenSettings?: () => void;
  showCompleted: boolean;
  setShowCompleted: (val: boolean) => void;
  onDeleteProject: (name: string) => void;
}

const CURATED_COLORS = [
  '#58a6ff',
  '#3fb950',
  '#bc8cff',
  '#ff7b72',
  '#e3b341',
  '#db61a2',
  '#f2cc60',
  '#8b949e',
];

export default function Sidebar({
  currentView,
  setCurrentView,
  currentProject,
  setCurrentProject,
  projects,
  onAddProject,
  tasks,
  isSleeping,
  setIsSleeping,
  onOpenSettings,
  showCompleted,
  setShowCompleted,
  onDeleteProject,
}: SidebarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [isAdding, setIsAdding] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#58a6ff');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modalNewProjectName, setModalNewProjectName] = useState('');
  const [modalNewProjectColor, setModalNewProjectColor] = useState('#58a6ff');

  const handleModalSaveProject = () => {
    if (!modalNewProjectName.trim()) return;
    onAddProject(modalNewProjectName.trim(), modalNewProjectColor);
    setModalNewProjectName('');
  };

  const todayBadgeCount = tasks.filter((t) => t.target === 'today' && !t.done).length;
  const backlogBadgeCount = tasks.filter((t) => t.target === 'backlog' && !t.done).length;

  const handleSaveProject = () => {
    if (!newProjectName.trim()) return;
    onAddProject(newProjectName.trim(), newProjectColor);
    setNewProjectName('');
    setIsAdding(false);
  };

  const views = [
    { id: 'today', label: "Today's Tasks", icon: '☀️', badge: todayBadgeCount },
    { id: 'scheduled', label: 'Scheduled', icon: '📅' },
    { id: 'timetracking', label: 'Time Tracking', icon: '⏱️' },
    { id: 'stats', label: 'Deep Stats', icon: '📈' },
    { id: 'backlog', label: 'Backlog', icon: '📥', badge: backlogBadgeCount },
  ];

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.ghSurface, borderRightColor: colors.ghBorder }]}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.ghText }]}>Eidon</Text>
      </View>
      
      <ScrollView style={styles.menuList} contentContainerStyle={styles.menuListContent} {...{ delaysContentTouches: false }}>
        <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>WORKSPACE</Text>
        {views.map((view) => {
          const isActive = currentView === view.id && !currentProject;
          return (
            <TouchableOpacity
              key={view.id}
              style={[
                styles.menuItem,
                isActive && { backgroundColor: colors.ghSurface2 }
              ]}
              onPress={() => {
                setCurrentView(view.id);
                setCurrentProject(null);
              }}
            >
              {isActive && <View style={[styles.activeIndicator, { backgroundColor: colors.ghBlue }]} />}
              <Text style={styles.menuIcon}>{view.icon}</Text>
              <Text style={[
                styles.menuText, 
                { color: isActive ? colors.ghText : colors.ghMuted }
              ]}>
                {view.label}
              </Text>
              {view.badge !== undefined && view.badge > 0 && (
                <View style={[styles.badgeContainer, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}>
                  <Text style={[styles.badgeText, { color: colors.ghText }]}>{view.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.projectsHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.ghMuted }]}>PROJECTS</Text>
          <TouchableOpacity 
            style={[styles.addProjBtn, { backgroundColor: isAdding ? colors.ghSurface2 : 'transparent' }]}
            onPress={() => setIsAdding(!isAdding)}
          >
            <Text style={{ color: colors.ghMuted, fontSize: 13 }}>+</Text>
          </TouchableOpacity>
        </View>

        {isAdding && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.addProjectBox, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}>
            {/* Color selector */}
            <View style={styles.colorChipsRow}>
              {CURATED_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorChip,
                    { backgroundColor: c },
                    newProjectColor === c && { borderColor: '#fff', borderWidth: 2 }
                  ]}
                  onPress={() => setNewProjectColor(c)}
                />
              ))}
            </View>
            
            {/* Input name */}
            <View style={[styles.addInputWrapper, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
              <View style={[styles.projectDot, { backgroundColor: newProjectColor }]} />
              <TextInput
                style={[styles.addInput, { color: colors.ghText }]}
                value={newProjectName}
                onChangeText={setNewProjectName}
                placeholder="Project name..."
                placeholderTextColor={colors.ghMuted}
                autoFocus
              />
            </View>

            {/* Buttons */}
            <View style={styles.addActionsRow}>
              <TouchableOpacity style={[styles.btnSmall, { borderColor: colors.ghBorder }]} onPress={() => setIsAdding(false)}>
                <Text style={{ color: colors.ghText, fontSize: 11 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSmall, styles.btnPrimary]} onPress={handleSaveProject}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
        
        {projects.map((proj) => {
          const isActive = currentProject === proj.name;
          return (
            <TouchableOpacity
              key={proj.name}
              style={[
                styles.menuItem,
                isActive && { backgroundColor: colors.ghSurface2 }
              ]}
              onPress={() => {
                setCurrentProject(proj.name);
                setCurrentView('today');
              }}
            >
              {isActive && <View style={[styles.activeIndicator, { backgroundColor: colors.ghBlue }]} />}
              <View style={[styles.projectColorDot, { backgroundColor: proj.color }]} />
              <Text style={[
                styles.menuText,
                { color: isActive ? colors.ghText : colors.ghMuted }
              ]} numberOfLines={1}>
                {proj.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sidebar Footer */}
      <View style={[styles.footer, { borderTopColor: colors.ghBorder }]}>
        <View style={styles.userSection}>
          <View style={[styles.avatar, { backgroundColor: colors.ghBlue }]}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          <Text style={[styles.userName, { color: colors.ghText }]} numberOfLines={1}>John Doe</Text>
        </View>

        <TouchableOpacity 
          style={styles.footerBtn} 
          onPress={() => setIsSettingsOpen(true)}
        >
          <Feather name="settings" size={16} color={colors.ghMuted} />
        </TouchableOpacity>
      </View>

      {/* Settings Modal */}
      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.ghBorder }]}>
              <Text style={[styles.modalTitle, { color: colors.ghText }]}>Settings</Text>
              <TouchableOpacity onPress={() => setIsSettingsOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.ghText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Task Preferences Section */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.ghMuted }]}>PREFERENCES</Text>
                <View style={styles.settingsRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.settingsLabel, { color: colors.ghText }]}>Show Completed Tasks</Text>
                    <Text style={[styles.settingsHelp, { color: colors.ghMuted }]}>
                      Toggle whether completed tasks are displayed in your lists.
                    </Text>
                  </View>
                  <Switch
                    value={showCompleted}
                    onValueChange={setShowCompleted}
                    trackColor={{ false: colors.ghBorder, true: colors.ghBlue }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {/* Add Project Section */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.ghMuted }]}>ADD PROJECT</Text>
                <View style={[styles.modalAddProjectBox, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}>
                  {/* Curated Colors */}
                  <View style={styles.colorChipsRow}>
                    {CURATED_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.colorChip,
                          { backgroundColor: c },
                          modalNewProjectColor === c && { borderColor: '#fff', borderWidth: 2 }
                        ]}
                        onPress={() => setModalNewProjectColor(c)}
                      />
                    ))}
                  </View>

                  <View style={[styles.addInputWrapper, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
                    <View style={[styles.projectDot, { backgroundColor: modalNewProjectColor }]} />
                    <TextInput
                      style={[styles.addInput, { color: colors.ghText }]}
                      value={modalNewProjectName}
                      onChangeText={setModalNewProjectName}
                      placeholder="New project name..."
                      placeholderTextColor={colors.ghMuted}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.modalAddBtn, { backgroundColor: colors.ghBlue }]}
                    onPress={handleModalSaveProject}
                  >
                    <Text style={styles.modalAddBtnText}>Add Project</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Manage Projects Section */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.ghMuted }]}>MANAGE PROJECTS</Text>
                {projects.length === 0 ? (
                  <Text style={{ color: colors.ghMuted, fontStyle: 'italic', fontSize: 13, paddingHorizontal: 4 }}>
                    No projects created yet.
                  </Text>
                ) : (
                  projects.map((proj) => (
                    <View
                      key={proj.name}
                      style={[
                        styles.projectManageItem,
                        { borderBottomColor: colors.ghBorder }
                      ]}
                    >
                      <View style={[styles.projectColorDot, { backgroundColor: proj.color }]} />
                      <Text style={[styles.projectManageName, { color: colors.ghText }]} numberOfLines={1}>
                        {proj.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => onDeleteProject(proj.name)}
                        style={styles.deleteProjBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Feather name="trash-2" size={14} color={colors.ghRed} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    height: '100%',
    borderRightWidth: 1,
    flexDirection: 'column',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 9,
    position: 'relative',
    height: 37,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  menuIcon: {
    fontSize: 14,
    width: 16,
    textAlign: 'center',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  badgeContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  projectsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    marginTop: 18,
    marginBottom: 6,
  },
  addProjBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  projectColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginHorizontal: 3,
  },
  addProjectBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
    gap: 8,
  },
  colorChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  colorChip: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    height: 28,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  addInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  addActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  btnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
  },
  btnPrimary: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  footerBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginLeft: 2,
    overflow: 'hidden',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  userName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 450,
    maxHeight: '80%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingsHelp: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalAddProjectBox: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 10,
  },
  modalAddBtn: {
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  projectManageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  projectManageName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  deleteProjBtn: {
    padding: 6,
  }
});
