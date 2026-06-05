import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, useColorScheme, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sidebar from '../components/Sidebar';
import TaskPanel from '../components/TaskPanel';
import DetailPanel, { Task, Session, AuditEntry } from '../components/DetailPanel';
import DeepStats from '../components/DeepStats';
import TimeTracking from '../components/TimeTracking';
import ScheduledView from '../components/ScheduledView';
import { Colors } from '../constants/theme';
import Header from '../components/Header';
import AddTaskModal from '../components/AddTaskModal';
import Animated, { SlideInRight, SlideOutRight, Easing, useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import tasksData from '../constants/tasks.json';

export default function AppIndex() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();
  const touchStartX = useRef(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const SIDEBAR_WIDTH = 220;
  const sidebarTranslate = useSharedValue(-SIDEBAR_WIDTH);
  const backdropOpacity = useSharedValue(0);

  const DURATION = 220;

  const openSidebar = () => {
    setSidebarVisible(true);
    setIsSidebarOpen(true);
    sidebarTranslate.value = withTiming(0, { duration: DURATION });
    backdropOpacity.value = withTiming(1, { duration: DURATION });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    sidebarTranslate.value = withTiming(-SIDEBAR_WIDTH, { duration: DURATION });
    backdropOpacity.value = withTiming(0, { duration: DURATION }, (finished) => {
      if (finished) runOnJS(setSidebarVisible)(false);
    });
  };

  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslate.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const [showCompleted, setShowCompleted] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [tasks, setTasks] = useState<Task[]>(tasksData.tasks);
  
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
      closeSidebar();
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
          onSwipeRight={!isLargeScreen ? openSidebar : undefined}
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
        selectedTaskId={selectedTaskId}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
      />
    );
  };

  const headerRight = (
    <TouchableOpacity
      style={[styles.addBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}
      onPress={() => setShowAddModal(true)}
    >
      <Text style={{ color: colors.ghText, fontSize: 12, fontWeight: '600' }}>+ Add Task</Text>
    </TouchableOpacity>
  );

  const headerTitle = currentProject || (currentView === 'today' ? 'Today' : currentView === 'backlog' ? 'Backlog' : currentView === 'scheduled' ? 'Scheduled' : currentView === 'stats' ? 'Deep Stats' : currentView === 'timetracking' ? 'Time Tracking' : currentView.charAt(0).toUpperCase() + currentView.slice(1));

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: any) => {
    if (isLargeScreen) return;
    if (currentView === 'scheduled') return;
    const dx = e.nativeEvent.pageX - touchStartX.current;
    if (dx > 60) openSidebar();
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.ghBg }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Header
        title={headerTitle}
        showMenuBtn={!isLargeScreen}
        onMenuPress={() => openSidebar()}
        right={headerRight}
      />
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
      {!isLargeScreen && (sidebarVisible || isSidebarOpen) && (
        <View style={styles.sidebarOverlay}>
          <Animated.View style={[styles.backdropContainer, backdropAnimatedStyle]}>
            <TouchableOpacity style={styles.backdrop} onPress={() => closeSidebar()} />
          </Animated.View>
          <Animated.View style={[styles.sidebarMobileContainer, { backgroundColor: colors.ghSurface }, sidebarAnimatedStyle]}>
            <View style={{ flex: 1 }}>
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
            </View>
          </Animated.View>
        </View>
      )}

      <AddTaskModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTask}
        projects={projects}
      />
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
    width: 220,
    height: '100%',
  },
  addBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
