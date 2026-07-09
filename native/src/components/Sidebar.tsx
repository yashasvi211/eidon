import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, useColorScheme, Modal, Switch } from 'react-native';
import { Colors } from '../constants/theme';
import { Task } from './DetailPanel';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { api } from '../services/api';
import * as WebBrowser from 'expo-web-browser';
import { DROPBOX_APP_KEY, DROPBOX_APP_SECRET } from '../constants/env';

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
  onDataChanged?: () => void;
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

const fmtDate = (ts: number | null) => {
  if (!ts) return 'Never';
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

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
  onDataChanged,
}: SidebarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [isAdding, setIsAdding] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#58a6ff');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modalNewProjectName, setModalNewProjectName] = useState('');
  const [modalNewProjectColor, setModalNewProjectColor] = useState('#58a6ff');

  // Dropbox / sync state
  const [dropboxToken, setDropboxToken] = useState('');
  const [dropboxPath, setDropboxPath] = useState('/eidon_db.json');
  const [syncInterval, setSyncInterval] = useState('30');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);

  // Load settings on mount / when settings opens
  useEffect(() => {
    if (isSettingsOpen) {
      api.getSettings().then((s) => {
        let token = s.dropboxToken || '';
        if (token && !s.dropboxRefreshToken) {
          // Auto-clear legacy token
          token = '';
          api.updateSettings({ dropboxToken: '', dropboxRefreshToken: '', tokenExpiresAt: 0 });
        }
        setDropboxToken(token);
        setDropboxPath(s.dropboxPath || '/eidon_db.json');
        setSyncInterval(String(s.syncIntervalMinutes || 30));
        setAutoSyncEnabled(s.autoSyncEnabled || false);
        setLastSyncTime(s.lastSyncTime || null);
      });
    } else {
      setSyncStatus(null);
      setConnectionStatus(null);
    }
  }, [isSettingsOpen]);

  const [authCode, setAuthCode] = useState('');

  const handleGetAuthCode = async () => {
    const scopes = 'account_info.read files.content.write files.content.read files.metadata.read files.metadata.write';
    const url = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=code&token_access_type=offline&scope=${encodeURIComponent(scopes)}`;
    await WebBrowser.openBrowserAsync(url);
  };

  const exchangeCode = async () => {
    if (!authCode.trim()) {
      setConnectionStatus('Please enter an auth code.');
      return;
    }
    setConnectionLoading(true);
    setConnectionStatus('Connecting to Dropbox...');
    try {
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=authorization_code&code=${authCode.trim()}&client_id=${DROPBOX_APP_KEY}&client_secret=${DROPBOX_APP_SECRET}`,
      });
      const data = await res.json();
      if (res.ok) {
        await api.updateSettings({
          dropboxToken: data.access_token,
          dropboxRefreshToken: data.refresh_token,
          tokenExpiresAt: Date.now() + (data.expires_in * 1000),
        });
        setDropboxToken(data.access_token);
        setConnectionStatus('Connected to Dropbox!');
        setAuthCode('');
      } else {
        setConnectionStatus(`Failed: ${data.error_description || data.error}`);
      }
    } catch (e: any) {
      setConnectionStatus(`Error: ${e.message}`);
    }
    setConnectionLoading(false);
  };

  const handleExport = async () => {
    try {
      await api.exportData();
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    }
  };

  const handleImport = async () => {
    try {
      const reloaded = await api.importData();
      if (reloaded) {
        alert('Import successful!');
        if (onDataChanged) onDataChanged();
      }
    } catch (e: any) {
      alert('Import failed: ' + e.message);
    }
  };

  const handleSaveSyncSettings = async () => {
    await api.updateSettings({
      dropboxToken: dropboxToken.trim(),
      dropboxPath: dropboxPath.trim() || '/eidon_db.json',
      syncIntervalMinutes: parseInt(syncInterval) || 30,
      autoSyncEnabled,
    });

    if (autoSyncEnabled && dropboxToken.trim()) {
      api.startAutoSync((result) => {
        setSyncStatus(result.message);
      });
    } else {
      api.stopAutoSync();
    }

    setSyncStatus('Settings saved');
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleTestConnection = async () => {
    setConnectionLoading(true);
    setConnectionStatus(null);
    const result = await api.testDropboxConnection();
    setConnectionStatus(result.message);
    setConnectionLoading(false);
  };

  const handleUpload = async () => {
    setSyncLoading(true);
    setSyncStatus(null);
    const result = await api.uploadToDropbox();
    setSyncStatus(result.message);
    setLastSyncTime(result.success ? Date.now() : lastSyncTime);
    setSyncLoading(false);
  };

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

      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.ghSurface, borderColor: colors.ghBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.ghBorder }]}>
              <Text style={[styles.modalTitle, { color: colors.ghText }]}>Settings</Text>
              <TouchableOpacity onPress={() => setIsSettingsOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.ghText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* PREFERENCES */}
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

              {/* EXPORT / IMPORT */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.ghMuted }]}>EXPORT / IMPORT</Text>
                <Text style={[styles.settingsHelp, { color: colors.ghMuted, marginBottom: 10 }]}>
                  Export your data as a JSON file or import from a previously exported file.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { flex: 1, backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, borderWidth: 1 }]}
                    onPress={handleExport}
                  >
                    <Feather name="upload" size={14} color={colors.ghText} style={{ marginRight: 6 }} />
                    <Text style={[styles.modalActionBtnText, { color: colors.ghText }]}>Export</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { flex: 1, backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, borderWidth: 1 }]}
                    onPress={handleImport}
                  >
                    <Feather name="download" size={14} color={colors.ghText} style={{ marginRight: 6 }} />
                    <Text style={[styles.modalActionBtnText, { color: colors.ghText }]}>Import</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* DROPBOX SYNC */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.ghMuted }]}>DROPBOX SYNC</Text>
                <Text style={[styles.settingsHelp, { color: colors.ghMuted, marginBottom: 10 }]}>
                  Backup and restore your data via Dropbox. All data stays on your device — Dropbox is only used for cloud storage.
                </Text>

                {/* API Upload (requires token) */}
                <View style={[styles.optionCard, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}>
                  <Text style={[styles.optionTitle, { color: colors.ghText }]}>Dropbox Connection</Text>
                  <Text style={[styles.optionDesc, { color: colors.ghMuted, marginBottom: 10 }]}>
                    Connect your Dropbox account to backup data and enable auto-sync.
                  </Text>

                  {dropboxToken ? (
                    <View style={{ marginBottom: 15 }}>
                      <Text style={[styles.statusText, { color: colors.ghGreen, marginBottom: 8 }]}>
                        ✓ Connected
                      </Text>
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, borderWidth: 1 }]}
                        onPress={async () => {
                          setDropboxToken('');
                          await api.updateSettings({ dropboxToken: '', dropboxRefreshToken: '', tokenExpiresAt: 0 });
                          setConnectionStatus(null);
                        }}
                      >
                        <Feather name="log-out" size={14} color={colors.ghRed} style={{ marginRight: 6 }} />
                        <Text style={[styles.modalActionBtnText, { color: colors.ghRed }]}>Disconnect</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ marginBottom: 15, gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, borderWidth: 1 }]}
                        onPress={handleGetAuthCode}
                      >
                        <Feather name="external-link" size={14} color={colors.ghText} style={{ marginRight: 6 }} />
                        <Text style={[styles.modalActionBtnText, { color: colors.ghText }]}>Step 1: Get Auth Code</Text>
                      </TouchableOpacity>
                      
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={[styles.settingsInput, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder, marginTop: 4 }]}
                          value={authCode}
                          onChangeText={setAuthCode}
                          placeholder="Step 2: Paste Auth Code Here"
                          placeholderTextColor={colors.ghMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: '#0061FE' }]}
                        onPress={exchangeCode}
                        disabled={connectionLoading || !authCode.trim()}
                      >
                        <Feather name="link" size={14} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={[styles.modalActionBtnText, { color: '#fff' }]}>
                          {connectionLoading ? 'Connecting...' : 'Step 3: Connect'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.ghMuted }]}>Dropbox File Path</Text>
                    <TextInput
                      style={[styles.settingsInput, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
                      value={dropboxPath}
                      onChangeText={setDropboxPath}
                      placeholder="/eidon_db.json"
                      placeholderTextColor={colors.ghMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {connectionStatus && (
                    <Text style={[styles.statusText, { color: connectionStatus.includes('Connected') ? colors.ghGreen : colors.ghRed, marginBottom: 8 }]}>
                      {connectionStatus}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder, borderWidth: 1, marginBottom: 10 }]}
                    onPress={handleTestConnection}
                    disabled={connectionLoading || !dropboxToken.trim()}
                  >
                    <Feather name={connectionLoading ? 'loader' : 'check-circle'} size={14} color={colors.ghText} style={{ marginRight: 6 }} />
                    <Text style={[styles.modalActionBtnText, { color: colors.ghText }]}>
                      {connectionLoading ? 'Testing...' : 'Test Connection'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { flex: 1, backgroundColor: colors.ghBlue }]}
                      onPress={handleUpload}
                      disabled={syncLoading || !dropboxToken.trim()}
                    >
                      <Feather name="upload-cloud" size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={[styles.modalActionBtnText, { color: '#fff' }]}>
                        {syncLoading ? '...' : 'Upload'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.settingsRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.settingsLabel, { color: colors.ghText }]}>Auto-sync</Text>
                      <Text style={[styles.settingsHelp, { color: colors.ghMuted }]}>
                        Automatically upload to Dropbox at regular intervals.
                      </Text>
                    </View>
                    <Switch
                      value={autoSyncEnabled}
                      onValueChange={setAutoSyncEnabled}
                      trackColor={{ false: colors.ghBorder, true: colors.ghBlue }}
                      thumbColor="#fff"
                    />
                  </View>

                  {autoSyncEnabled && (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.ghMuted }]}>Sync Interval (minutes)</Text>
                      <TextInput
                        style={[styles.settingsInput, { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder }]}
                        value={syncInterval}
                        onChangeText={setSyncInterval}
                        placeholder="30"
                        placeholderTextColor={colors.ghMuted}
                        keyboardType="number-pad"
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.ghBlue, marginTop: 8 }]}
                    onPress={handleSaveSyncSettings}
                  >
                    <Text style={styles.saveBtnText}>Save Sync Settings</Text>
                  </TouchableOpacity>
                </View>

                {syncStatus && (
                  <Text style={[styles.statusText, { color: syncStatus.includes('fail') || syncStatus.includes('error') || syncStatus.includes('Invalid') || syncStatus.includes('Invalid') ? colors.ghRed : colors.ghGreen, marginTop: 8 }]}>
                    {syncStatus}
                  </Text>
                )}

                <Text style={[styles.syncInfo, { color: colors.ghMuted }]}>
                  Last sync: {fmtDate(lastSyncTime)}
                </Text>

                <Text style={[styles.syncHelpText, { color: colors.ghMuted }]}>
                  Your connection is saved securely and refreshes automatically.
                </Text>
              </View>

              {/* ADD PROJECT */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.ghMuted }]}>ADD PROJECT</Text>
                <View style={[styles.modalAddProjectBox, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}>
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

              {/* MANAGE PROJECTS */}
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
    maxWidth: 480,
    maxHeight: '90%',
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
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  settingsInput: {
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
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
  modalActionBtn: {
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  syncInfo: {
    fontSize: 11,
    marginTop: 8,
  },
  syncHelpText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
    fontStyle: 'italic',
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11,
    lineHeight: 15,
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
