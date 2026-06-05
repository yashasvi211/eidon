import React, { useState, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, useColorScheme, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Sidebar from '../components/Sidebar';
import TaskPanel from '../components/TaskPanel';
import DetailPanel, { Task, Session, AuditEntry } from '../components/DetailPanel';
import DeepStats from '../components/DeepStats';
import TimeTracking from '../components/TimeTracking';
import ScheduledView from '../components/ScheduledView';
import { Colors } from '../constants/theme';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft, SlideInRight, SlideOutRight, Easing } from 'react-native-reanimated';

export default function AppIndex() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);

  // Seed tasks with the full data structure matching tasks.json
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 't1',
      title: 'Bill of Material Core Redesign',
      project: 'Bill of Material',
      due: '2026-04-25',
      est: '12h',
      notes: 'Complete overhaul of the BOM module to support multi-level assemblies. Requires database schema migration, new API endpoints, and a completely reworked frontend. Coordinate with QA for regression testing.',
      done: false,
      target: 'today',
      subtasks: [
        { id: 's1', title: 'Implement new type system in PostgreSQL', done: true },
        { id: 's2', title: 'Refactor Site ID validation logic', done: true },
        { id: 's3', title: 'Optimize scaling algorithms for large datasets', done: false },
        { id: 's4', title: 'Connect frontend React components to new API', done: false }
      ],
      sessions: [
        { id: 'sess1', start: 1743465600000, end: 1743469200000 },
        { id: 'sess2', start: 1743472800000, end: 1743476400000 }
      ],
      createdAt: 1743379200000,
      completedAt: null,
      auditLog: [
        { timestamp: 1743379200000, action: 'created' }
      ]
    },
    {
      id: 't2',
      title: 'HubSpot OAuth Integration',
      project: 'HubSpot Integration',
      due: '2026-05-23',
      est: '8h',
      notes: 'Implement secure OAuth2 authorization code flow for HubSpot API. Must support token refresh rotation, handle rate limiting, and store encrypted tokens.',
      done: false,
      target: 'today',
      subtasks: [
        { id: 's11', title: 'Create developer portal app in HubSpot', done: true },
        { id: 's12', title: 'Configure redirect URIs and OAuth scopes', done: true },
        { id: 's13', title: 'Implement token exchange logic with PKCE', done: false }
      ],
      sessions: [
        { id: 'sess6', start: 1743811200000, end: 1743814800000 }
      ],
      createdAt: 1743724800000,
      completedAt: null,
      auditLog: [
        { timestamp: 1743724800000, action: 'created' }
      ]
    },
    {
      id: 't3',
      title: 'Nightly Audit Log Backup System',
      project: 'GitHub Logs Backup',
      due: '2026-05-21',
      est: '4h',
      notes: 'Automated system to export GitHub Enterprise audit logs to AWS S3 for compliance. Must handle pagination across large orgs, support incremental backups, and include alerting on failure.',
      done: false,
      target: 'today',
      subtasks: [],
      sessions: [],
      createdAt: 1743897600000,
      completedAt: null,
      auditLog: [
        { timestamp: 1743897600000, action: 'created' }
      ]
    },
    {
      id: 't4',
      title: 'Sprint Retrospective Meeting',
      project: 'Inbox',
      due: '2026-05-20',
      est: '1.5h',
      notes: 'Bi-weekly team retrospective to reflect on sprint 12. Agenda: review velocity metrics, discuss what went well, what didn\'t, and action items for next sprint.',
      done: true,
      target: 'scheduled',
      subtasks: [
        { id: 's26', title: 'Prepare Miro retro board', done: true },
        { id: 's27', title: 'Compile sprint velocity report', done: true }
      ],
      sessions: [
        { id: 'sess10', start: 1744156800000, end: 1744162200000 }
      ],
      createdAt: 1744070400000,
      completedAt: 1744162200000,
      auditLog: [
        { timestamp: 1744070400000, action: 'created' },
        { timestamp: 1744162200000, action: 'completed' }
      ]
    },
    {
      id: 't5',
      title: 'Explore Modern UI Design Tokens',
      project: 'Inbox',
      due: '',
      est: '5h',
      notes: 'Research and prototype migration to a more robust design token system. Evaluate approaches: CSS custom properties vs Style Dictionary vs Tailwind v4 theming.',
      done: false,
      target: 'backlog',
      subtasks: [
        { id: 's35', title: 'Research Style Dictionary token format', done: true }
      ],
      sessions: [],
      createdAt: 1744156800000,
      completedAt: null,
      auditLog: [
        { timestamp: 1744156800000, action: 'created' }
      ]
    }
  ]);
  
  const [currentView, setCurrentView] = useState('today');
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  const [projects, setProjects] = useState([
    { name: 'HubSpot Integration', color: '#58a6ff' },
    { name: 'Bill of Material', color: '#3fb950' },
    { name: 'GitHub Logs Backup', color: '#bc8cff' },
    { name: 'Inbox', color: '#8b949e' },
  ]);

  // Sleep mode state
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState<number | null>(null);

  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);

  // Live stopwatch ticks
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && activeTimerTaskId) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, activeTimerTaskId]);

  // Handle sleep mode transitions
  useEffect(() => {
    if (isSleeping) {
      setSleepStartTime(Date.now());
    } else {
      setSleepStartTime(null);
    }
  }, [isSleeping]);

  // Derived selected task
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  const toggleDone = (id: string) => {
    setTasks(
      tasks.map((t) => {
        if (t.id !== id) return t;
        const isDone = !t.done;
        
        // Add audit entry
        const auditEntry: AuditEntry = {
          timestamp: Date.now(),
          action: isDone ? 'completed' : 'uncompleted',
        };
        
        return {
          ...t,
          done: isDone,
          completedAt: isDone ? Date.now() : null,
          auditLog: [...(t.auditLog || []), auditEntry],
        };
      })
    );
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleAddTask = (title: string, project: string = 'Inbox', due?: string) => {
    const newTask: Task = {
      id: 't' + Date.now(),
      title,
      project,
      due,
      done: false,
      target: currentView === 'backlog' ? 'backlog' : currentView === 'scheduled' ? 'scheduled' : 'today',
      subtasks: [],
      sessions: [],
      createdAt: Date.now(),
      auditLog: [
        {
          timestamp: Date.now(),
          action: 'created',
        }
      ]
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleStartTimer = (taskId: string) => {
    setIsTimerRunning(true);
    setActiveTimerTaskId(taskId);
    setTimerSeconds(0);
    setTimerStartTimestamp(Date.now());

    // Audit log
    setTasks(
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const audit: AuditEntry = {
          timestamp: Date.now(),
          action: 'timer_started',
        };
        return {
          ...t,
          auditLog: [...(t.auditLog || []), audit],
        };
      })
    );
  };

  const handleStopTimer = (note: string) => {
    if (!activeTimerTaskId || !timerStartTimestamp) return;

    const start = timerStartTimestamp;
    const end = Date.now();
    const newSession: Session = {
      id: 'sess' + Date.now(),
      start,
      end,
      note: note.trim() || undefined,
    };

    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: 'timer_stopped',
      details: {
        note: note.trim() || undefined,
      },
    };

    setTasks(
      tasks.map((t) => {
        if (t.id !== activeTimerTaskId) return t;
        return {
          ...t,
          sessions: [...(t.sessions || []), newSession],
          auditLog: [...(t.auditLog || []), audit],
        };
      })
    );

    setIsTimerRunning(false);
    setActiveTimerTaskId(null);
    setTimerStartTimestamp(null);
    setTimerSeconds(0);
  };

  const handleAddProject = (name: string, color: string) => {
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    setProjects([...projects, { name, color }]);
    setCurrentProject(name);
    setCurrentView('today');
  };

  const closeSidebarMobile = () => {
    if (!isLargeScreen) {
      setIsSidebarOpen(false);
    }
  };

  const renderMiddlePanel = () => {
    if (currentView === 'stats') {
      return <DeepStats tasks={tasks} />;
    }
    if (currentView === 'timetracking') {
      return (
        <TimeTracking 
          tasks={tasks} 
          isSleeping={isSleeping} 
          sleepStartTime={sleepStartTime} 
        />
      );
    }
    if (currentView === 'scheduled') {
      return (
        <ScheduledView 
          tasks={tasks} 
          onSelectTask={(t) => { setSelectedTaskId(t.id); }} 
          showCompleted={showCompleted} 
        />
      );
    }

    return (
      <TaskPanel 
        tasks={tasks}
        projects={projects}
        currentView={currentView}
        currentProject={currentProject}
        toggleDone={toggleDone}
        onOpenDetail={(t) => { setSelectedTaskId(t.id); }}
        onMenuPress={() => setIsSidebarOpen(true)}
        showMenuBtn={!isLargeScreen}
        selectedTaskId={selectedTaskId}
        onAddTask={handleAddTask}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ghBg }}>
      <View style={styles.appRow}>
        {/* Sidebar for Large Screens */}
        {isLargeScreen && (
          <Sidebar 
            currentView={currentView}
            setCurrentView={setCurrentView}
            currentProject={currentProject}
            setCurrentProject={setCurrentProject}
            projects={projects}
            onAddProject={handleAddProject}
            tasks={tasks}
            isSleeping={isSleeping}
            setIsSleeping={setIsSleeping}
            onOpenSettings={() => {}}
          />
        )}

        {/* Task List / Stats / Time Tracking / Calendar Panel */}
        {(!selectedTaskId || isLargeScreen) && (
          <View style={styles.middlePanel}>
            {renderMiddlePanel()}
          </View>
        )}

        {/* Detail Panel with stack slide animation on Mobile */}
        {isLargeScreen ? (
          <View style={styles.rightPanel}>
            <DetailPanel 
              task={selectedTask}
              onClose={() => setSelectedTaskId(null)}
              onToggleDone={toggleDone}
              onUpdateTask={handleUpdateTask}
              isTimerRunning={isTimerRunning}
              timerSeconds={timerSeconds}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              activeTimerTaskId={activeTimerTaskId}
            />
          </View>
        ) : selectedTaskId ? (
          <Animated.View 
            entering={SlideInRight.duration(220).easing(Easing.out(Easing.cubic))}
            exiting={SlideOutRight.duration(180).easing(Easing.in(Easing.cubic))}
            style={[styles.middlePanel, { paddingTop: insets.top }]}
          >
            <DetailPanel 
              task={selectedTask}
              onClose={() => setSelectedTaskId(null)}
              onToggleDone={toggleDone}
              onUpdateTask={handleUpdateTask}
              isTimerRunning={isTimerRunning}
              timerSeconds={timerSeconds}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              activeTimerTaskId={activeTimerTaskId}
            />
          </Animated.View>
        ) : null}
      </View>

      {/* Sidebar Overlay Drawer with slide-in animation for Mobile */}
      {!isLargeScreen && isSidebarOpen && (
        <View style={styles.sidebarOverlay}>
          <Animated.View 
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.backdropContainer}
          >
            <TouchableOpacity style={styles.backdrop} onPress={() => setIsSidebarOpen(false)} />
          </Animated.View>
          <Animated.View 
            entering={SlideInLeft.duration(220).easing(Easing.out(Easing.cubic))}
            exiting={SlideOutLeft.duration(180).easing(Easing.in(Easing.cubic))}
            style={[styles.sidebarMobileContainer, { backgroundColor: colors.ghSurface }]}
          >
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left']}>
              <Sidebar 
                currentView={currentView}
                setCurrentView={(v: string) => { setCurrentView(v); closeSidebarMobile(); }}
                currentProject={currentProject}
                setCurrentProject={(p: string | null) => { setCurrentProject(p); closeSidebarMobile(); }}
                projects={projects}
                onAddProject={handleAddProject}
                tasks={tasks}
                isSleeping={isSleeping}
                setIsSleeping={setIsSleeping}
                onOpenSettings={() => { closeSidebarMobile(); }}
              />
            </SafeAreaView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appRow: {
    flex: 1,
    flexDirection: 'row',
  },
  middlePanel: {
    flex: 1,
  },
  rightPanel: {
    width: 320,
    flexShrink: 0,
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 100,
  },
  backdropContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebarMobileContainer: {
    width: 260,
    height: '100%',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  }
});
