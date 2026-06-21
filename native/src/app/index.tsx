import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  useColorScheme,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Sidebar from "../components/Sidebar";
import TaskPanel from "../components/TaskPanel";
import DetailPanel, {
  Task,
  Session,
  AuditEntry,
} from "../components/DetailPanel";
import DeepStats from "../components/DeepStats";
import TimeTracking from "../components/TimeTracking";
import ScheduledView from "../components/ScheduledView";
import { Colors } from "../constants/theme";
import Header from "../components/Header";
import AddTaskModal from "../components/AddTaskModal";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import tasksData from "../constants/mockTasks.json";
import { api } from "../services/api";


export default function AppIndex() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];
  const insets = useSafeAreaInsets();
  const touchStartX = useRef(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const SIDEBAR_WIDTH = 220;
  const sidebarTranslate = useSharedValue(-SIDEBAR_WIDTH);
  const backdropOpacity = useSharedValue(0);

  const DURATION = 350;

  const openSidebar = () => {
    setSidebarVisible(true);
    setIsSidebarOpen(true);
    sidebarTranslate.value = withTiming(0, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(1, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    sidebarTranslate.value = withTiming(-SIDEBAR_WIDTH, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(
      0,
      {
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(setSidebarVisible)(false);
      },
    );
  };

  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslate.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const [showCompleted, setShowCompleted] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState("");
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const showErrorAlert = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const [tasks, setTasks] = useState<Task[]>(() => {
    const BASE_DATE_MS = 1782000000000; // Approx June 21, 2026
    const timeOffset = Date.now() - BASE_DATE_MS;

    return (tasksData.tasks as Task[]).map((task) => {
      const shiftedSessions = (task.sessions || []).map((sess) => ({
        ...sess,
        start: sess.start + timeOffset,
        end: sess.end + timeOffset,
      }));

      const shiftedAuditLog = (task.auditLog || []).map((entry) => ({
        ...entry,
        timestamp: entry.timestamp + timeOffset,
      }));

      return {
        ...task,
        createdAt: task.createdAt ? task.createdAt + timeOffset : task.createdAt,
        completedAt: task.completedAt ? task.completedAt + timeOffset : null,
        sessions: shiftedSessions,
        auditLog: shiftedAuditLog,
      };
    });
  });

  const [currentView, setCurrentView] = useState("today");
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "details" | "checklist" | "timetracking" | "history"
  >("details");

  const [projects, setProjects] = useState([
    { name: "HubSpot Integration", color: "#58a6ff" },
    { name: "Bill of Material", color: "#3fb950" },
    { name: "GitHub Logs Backup", color: "#bc8cff" },
    { name: "Inbox", color: "#8b949e" },
  ]);

  // Sleep mode state
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState<number | null>(null);

  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(
    null,
  );
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(
    null,
  );

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

  // Load tasks, projects, and settings on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const fetchedTasks = await api.getTasks();
        const fetchedProjects = await api.getProjects();
        const fetchedSettings = await api.getSettings();

        if (fetchedTasks.length > 0) {
          setTasks(fetchedTasks);
        }
        if (fetchedProjects.length > 0) {
          setProjects(fetchedProjects);
        }
        if (fetchedSettings) {
          setIsSleeping(fetchedSettings.isSleeping);
          setSleepStartTime(fetchedSettings.sleepStartTime);
        }
      } catch (err) {
        console.error("Failed to load initial data from backend:", err);
      }
    }
    loadInitialData();
  }, []);

  // Handle sleep mode transitions
  useEffect(() => {
    const nextStart = isSleeping ? Date.now() : null;
    setSleepStartTime(nextStart);
    api.updateSettings({ isSleeping, sleepStartTime: nextStart })
      .catch((err) => console.error("Failed to sync sleep settings:", err));
  }, [isSleeping]);

  // Derived selected task
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const [activeMobileTask, setActiveMobileTask] = useState<Task | null>(null);

  useEffect(() => {
    if (selectedTask) {
      setActiveMobileTask(selectedTask);
    }
  }, [selectedTask]);

  useEffect(() => {
    setActiveTab("details");
  }, [selectedTaskId]);

  const toggleDone = (id: string) => {
    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    if (!taskToToggle.done) {
      const hasUncompletedSubtasks = (taskToToggle.subtasks || []).some(
        (sub) => !sub.done
      );
      if (hasUncompletedSubtasks) {
        showErrorAlert(
          "Cannot Complete Task",
          "You must complete all subtasks before marking this task as completed."
        );
        return;
      }
    }

    const isDone = !taskToToggle.done;
    const completedAt = isDone ? Date.now() : null;
    const auditEntry: AuditEntry = {
      timestamp: Date.now(),
      action: isDone ? "completed" : "uncompleted",
    };

    setTasks(
      tasks.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          done: isDone,
          completedAt,
          auditLog: [...(t.auditLog || []), auditEntry],
        };
      }),
    );

    // Sync with API
    api.updateTask(id, { done: isDone, completedAt })
      .then(() => api.createAuditLog(id, auditEntry))
      .catch((err) => console.error("Failed to sync task toggleDone:", err));
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const oldTask = tasks.find((t) => t.id === updatedTask.id);
    if (!oldTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      );
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    );

    // Sync task fields updates
    const fieldsChanged =
      oldTask.title !== updatedTask.title ||
      oldTask.due !== updatedTask.due ||
      oldTask.est !== updatedTask.est ||
      oldTask.notes !== updatedTask.notes ||
      oldTask.project !== updatedTask.project ||
      oldTask.target !== updatedTask.target ||
      oldTask.done !== updatedTask.done ||
      oldTask.completedAt !== updatedTask.completedAt;

    if (fieldsChanged) {
      api.updateTask(updatedTask.id, {
        title: updatedTask.title,
        project: updatedTask.project,
        due: updatedTask.due,
        est: updatedTask.est,
        notes: updatedTask.notes,
        done: updatedTask.done,
        completedAt: updatedTask.completedAt,
        target: updatedTask.target,
      }).catch((err) => console.error("Failed to sync task updates:", err));
    }

    // Sync subtask additions/updates/deletions
    const oldSubtasks = oldTask.subtasks || [];
    const newSubtasks = updatedTask.subtasks || [];

    // Find added subtasks
    const addedSubtasks = newSubtasks.filter(
      (n) => !oldSubtasks.some((o) => o.id === n.id)
    );
    for (const sub of addedSubtasks) {
      api.createSubtask(updatedTask.id, sub)
        .catch((err) => console.error("Failed to sync subtask creation:", err));
    }

    // Find modified subtasks
    const modifiedSubtasks = newSubtasks.filter((n) => {
      const oldSub = oldSubtasks.find((o) => o.id === n.id);
      return oldSub && (oldSub.done !== n.done || oldSub.title !== n.title);
    });
    for (const sub of modifiedSubtasks) {
      api.updateSubtask(updatedTask.id, sub.id, {
        title: sub.title,
        done: sub.done,
      }).catch((err) => console.error("Failed to sync subtask update:", err));
    }

    // Find deleted subtasks
    const deletedSubtasks = oldSubtasks.filter(
      (o) => !newSubtasks.some((n) => n.id === o.id)
    );
    for (const sub of deletedSubtasks) {
      api.deleteSubtask(updatedTask.id, sub.id)
        .catch((err) => console.error("Failed to sync subtask deletion:", err));
    }

    // Sync audit log additions
    const oldAudit = oldTask.auditLog || [];
    const newAudit = updatedTask.auditLog || [];
    const addedAudit = newAudit.slice(oldAudit.length);
    for (const entry of addedAudit) {
      api.createAuditLog(updatedTask.id, entry)
        .catch((err) => console.error("Failed to sync audit log entry:", err));
    }
  };

  const handleAddTask = (
    title: string,
    project: string = "Inbox",
    due?: string,
  ) => {
    const newTask: Task = {
      id: "t" + Date.now(),
      title,
      project,
      due,
      done: false,
      target:
        currentView === "backlog"
          ? "backlog"
          : currentView === "scheduled"
            ? "scheduled"
            : "today",
      subtasks: [],
      sessions: [],
      createdAt: Date.now(),
      auditLog: [
        {
          timestamp: Date.now(),
          action: "created",
        },
      ],
    };
    setTasks((prev) => [...prev, newTask]);

    // Sync with API
    api.createTask(newTask)
      .then(() => api.createAuditLog(newTask.id, newTask.auditLog![0]))
      .catch((err) => console.error("Failed to create task in backend:", err));
  };

  const handleStartTimer = (taskId: string) => {
    setIsTimerRunning(true);
    setActiveTimerTaskId(taskId);
    setTimerSeconds(0);
    setTimerStartTimestamp(Date.now());

    // Audit log
    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: "timer_started",
    };

    setTasks(
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          auditLog: [...(t.auditLog || []), audit],
        };
      }),
    );

    // Sync with API
    api.createAuditLog(taskId, audit)
      .catch((err) => console.error("Failed to sync timer_started audit log:", err));
  };

  const handleStopTimer = (note: string) => {
    if (!activeTimerTaskId || !timerStartTimestamp) return;

    const start = timerStartTimestamp;
    const end = Date.now();
    const newSession: Session = {
      id: "sess" + Date.now(),
      start,
      end,
      note: note.trim() || undefined,
    };

    const audit: AuditEntry = {
      timestamp: Date.now(),
      action: "timer_stopped",
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
      }),
    );

    const taskId = activeTimerTaskId;
    setIsTimerRunning(false);
    setActiveTimerTaskId(null);
    setTimerStartTimestamp(null);
    setTimerSeconds(0);

    // Sync with API
    api.createSession(taskId, newSession)
      .then(() => api.createAuditLog(taskId, audit))
      .catch((err) => console.error("Failed to sync timer session stop:", err));
  };

  const handleAddProject = (name: string, color: string) => {
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      return;
    setProjects([...projects, { name, color }]);
    setCurrentProject(name);
    setCurrentView("today");

    // Sync with API
    api.createProject({ name, color })
      .catch((err) => console.error("Failed to create project in backend:", err));
  };

  const handleDeleteProject = (name: string) => {
    setProjects(projects.filter((p) => p.name !== name));
    if (currentProject === name) {
      setCurrentProject(null);
      setCurrentView("today");
    }
    setTasks(tasks.filter((t) => t.project !== name));

    // Sync with API
    api.deleteProject(name)
      .catch((err) => console.error("Failed to delete project in backend:", err));
  };

  const closeSidebarMobile = () => {
    if (!isLargeScreen) {
      closeSidebar();
    }
  };

  const renderMiddlePanel = () => {
    if (currentView === "stats") {
      return <DeepStats tasks={tasks} />;
    }
    if (currentView === "timetracking") {
      return (
        <TimeTracking
          tasks={tasks}
          isSleeping={isSleeping}
          sleepStartTime={sleepStartTime}
          isTimerRunning={isTimerRunning}
          activeTimerTaskId={activeTimerTaskId}
          timerSeconds={timerSeconds}
        />
      );
    }
    if (currentView === "scheduled") {
      return (
        <ScheduledView
          tasks={tasks}
          onSelectTask={(t) => {
            setSelectedTaskId(t.id);
          }}
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
        onOpenDetail={(t) => {
          setSelectedTaskId(t.id);
        }}
        selectedTaskId={selectedTaskId}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
      />
    );
  };

  const headerRight = (
    <TouchableOpacity
      style={[
        styles.addBtn,
        { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder },
      ]}
      onPress={() => setShowAddModal(true)}
    >
      <Text style={{ color: colors.ghText, fontSize: 12, fontWeight: "600" }}>
        + Add Task
      </Text>
    </TouchableOpacity>
  );

  const headerTitle =
    currentProject ||
    (currentView === "today"
      ? "Today"
      : currentView === "backlog"
        ? "Backlog"
        : currentView === "scheduled"
          ? "Scheduled"
          : currentView === "stats"
            ? "Deep Stats"
            : currentView === "timetracking"
              ? "Time Tracking"
              : currentView.charAt(0).toUpperCase() + currentView.slice(1));

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: any) => {
    if (isLargeScreen) return;
    const dx = e.nativeEvent.pageX - touchStartX.current;

    if (!selectedTaskId && dx > 60 && currentView !== "scheduled") {
      openSidebar();
    }
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
            showCompleted={showCompleted}
            setShowCompleted={setShowCompleted}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {/* Task List / Stats / Time Tracking / Calendar Panel */}
        <View style={styles.middlePanel}>{renderMiddlePanel()}</View>

        {/* Detail Panel for Large Screens */}
        {isLargeScreen && (
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
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </View>
        )}

        {/* Detail Panel overlay on Mobile — slides up from bottom, Header stays visible */}
        {!isLargeScreen && !!selectedTaskId && (
          <View style={styles.mobileDetailOverlay}>
            <DetailPanel
              task={activeMobileTask}
              onClose={() => setSelectedTaskId(null)}
              onToggleDone={toggleDone}
              onUpdateTask={handleUpdateTask}
              isTimerRunning={isTimerRunning}
              timerSeconds={timerSeconds}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              activeTimerTaskId={activeTimerTaskId}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </View>
        )}
      </View>

      {/* Sidebar Overlay Drawer with slide-in animation for Mobile */}
      {!isLargeScreen && (sidebarVisible || isSidebarOpen) && (
        <View style={styles.sidebarOverlay}>
          <Animated.View
            style={[styles.backdropContainer, backdropAnimatedStyle]}
          >
            <TouchableOpacity
              style={styles.backdrop}
              onPress={() => closeSidebar()}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.sidebarMobileContainer,
              { backgroundColor: colors.ghSurface },
              sidebarAnimatedStyle,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Sidebar
                currentView={currentView}
                setCurrentView={(v: string) => {
                  setCurrentView(v);
                  closeSidebarMobile();
                }}
                currentProject={currentProject}
                setCurrentProject={(p: string | null) => {
                  setCurrentProject(p);
                  closeSidebarMobile();
                }}
                projects={projects}
                onAddProject={handleAddProject}
                tasks={tasks}
                isSleeping={isSleeping}
                setIsSleeping={setIsSleeping}
                showCompleted={showCompleted}
                setShowCompleted={setShowCompleted}
                onDeleteProject={handleDeleteProject}
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

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.errorOverlay}>
          <View
            style={[
              styles.errorModal,
              {
                backgroundColor: colors.ghSurface,
                borderColor: colors.ghRed,
              },
            ]}
          >
            <View style={styles.errorHeader}>
              <Feather name="alert-triangle" size={20} color={colors.ghRed} />
              <Text style={[styles.errorTitle, { color: colors.ghText }]}>
                {errorModalTitle}
              </Text>
            </View>
            <Text style={[styles.errorMessage, { color: colors.ghMuted }]}>
              {errorModalMessage}
            </Text>
            <TouchableOpacity
              style={[
                styles.errorCloseBtn,
                { backgroundColor: colors.ghRed },
              ]}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.errorCloseBtnText}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appRow: {
    flex: 1,
    flexDirection: "row",
  },
  middlePanel: {
    flex: 1,
  },
  rightPanel: {
    width: 320,
    flexShrink: 0,
  },
  mobileDetailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  sidebarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 100,
  },
  backdropContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sidebarMobileContainer: {
    width: 220,
    height: "100%",
  },
  addBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  errorOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  errorCloseBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  errorCloseBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
