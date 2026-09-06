import { useState, useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import "./App.css";
import Sidebar from "./components/Sidebar";
import TaskPanel from "./components/TaskPanel";
import DetailPanel from "./components/DetailPanel";
import DeepStats from "./components/DeepStats";
import TimeTracking from "./components/TimeTracking";
import AddTaskModal from "./components/AddTaskModal";
import ScheduledView from "./components/ScheduledView";
import LoadingScreen from "./components/LoadingScreen";
import SettingsModal from "./components/SettingsModal";
import EditTaskModal from "./components/EditTaskModal";
import StartTimerModal from "./components/StartTimerModal";
import { advanceRecurringTaskDue } from "./utils/reminderUtils";

// ============================================================
// UTILITIES
// ============================================================

const genId = () => "t" + Date.now() + Math.floor(Math.random() * 1000);

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState("today");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [currentProject, setCurrentProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("eidon_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          showCompleted: true, 
          sleepStart: "22:00", 
          sleepEnd: "07:00", 
          ...parsed 
        };
      } catch (e) {
        console.error("Failed to parse settings from localStorage", e);
      }
    }
    return { 
      appSize: 100, 
      showCompleted: true, 
      sleepStart: "22:00", 
      sleepEnd: "07:00" 
    };
  });

  useEffect(() => {
    localStorage.setItem("eidon_settings", JSON.stringify(settings));
  }, [settings]);
  const [isSleeping, setIsSleeping] = useState(() => {
    const saved = localStorage.getItem("eidon_is_sleeping");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("eidon_is_sleeping", isSleeping);
  }, [isSleeping]);

  const [sleepStartTime, setSleepStartTime] = useState(() => {
    const saved = localStorage.getItem("eidon_sleep_start");
    return saved ? Number(saved) : null;
  });

  const updateSleeping = (val) => {
    setIsSleeping((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (next) {
        const now = Date.now();
        setSleepStartTime(now);
        localStorage.setItem("eidon_sleep_start", String(now));
      } else {
        setSleepStartTime(null);
        localStorage.removeItem("eidon_sleep_start");
      }
      return next;
    });
  };

  // Dynamic Projects State with localStorage support
  const [projects, setProjects] = useState(() => {
    const saved = localStorage.getItem("eidon_projects");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse projects from localStorage", e);
      }
    }
    return [
      { name: "HubSpot Integration", color: "#58a6ff" },
      { name: "Bill of Material", color: "#3fb950" },
      { name: "GitHub Logs Backup", color: "#bc8cff" },
      { name: "Inbox", color: "#8b949e" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("eidon_projects", JSON.stringify(projects));
  }, [projects]);

  const handleAddProject = (name, color) => {
    if (!name.trim()) return;
    if (
      projects.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())
    ) {
      return;
    }
    const newProj = { name: name.trim(), color };
    setProjects([...projects, newProj]);
    setCurrentProject(newProj.name);
    setCurrentView("today");
  };

  const handleDeleteProject = (projectName) => {
    if (projectName === "Inbox") return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete project "${projectName}"? Tasks will be moved to Inbox.`,
    );
    if (!confirmDelete) return;

    setProjects(projects.filter((p) => p.name !== projectName));
    setTasks(
      tasks.map((t) =>
        t.project === projectName ? { ...t, project: "Inbox" } : t,
      ),
    );
    if (currentProject === projectName) {
      setCurrentProject(null);
    }
  };

  const handleDeleteTask = (taskId) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
    if (selectedTaskId === taskId) {
      const remaining = tasks.filter((t) => t.id !== taskId);
      setSelectedTaskId(remaining.length > 0 ? remaining[0].id : null);
    }
    setIsEditModalOpen(false);
  };

  const handleToggleMute = (taskId) => {
    setTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, muted: !t.muted } : t))
    );
  };

  const handleUpdateProject = (oldName, newName, newColor) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.name === oldName ? { ...p, name: newName, color: newColor } : p
      )
    );
    setTasks((prev) =>
      prev.map((t) => (t.project === oldName ? { ...t, project: newName } : t))
    );
    if (currentProject === oldName) {
      setCurrentProject(newName);
    }
  };

  const handleEditTask = (taskOrId, changes, reason) => {
    if (taskOrId && typeof taskOrId === "object" && taskOrId.id) {
      const updatedTask = taskOrId;
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
      return;
    }
    const taskId = taskOrId;
    setTasks(
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const newAuditEntries = [];
        const updated = { ...t };

        if (changes && "due" in changes) {
          newAuditEntries.push({
            id: "audit" + Date.now() + "a",
            timestamp: Date.now(),
            action: "due_changed",
            details: {
              from: changes.oldDue || "(none)",
              to: changes.due || "(none)",
              reason,
            },
          });
          updated.due = changes.due;
        }

        if (changes && "est" in changes) {
          newAuditEntries.push({
            id: "audit" + Date.now() + "b",
            timestamp: Date.now(),
            action: "estimate_changed",
            details: {
              from: changes.oldEst || "(none)",
              to: changes.est || "(none)",
              reason,
            },
          });
          updated.est = changes.est;
        }

        if (changes && "notes" in changes) {
          updated.notes = changes.notes;
        }

        updated.auditLog = [...(updated.auditLog || []), ...newAuditEntries];
        return updated;
      }),
    );
  };

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeSessionStart, setActiveSessionStart] = useState(null);
  const [isTimerNoteModalOpen, setIsTimerNoteModalOpen] = useState(false);
  const [timerNote, setTimerNote] = useState("");
  const [sessionSubtasksCompleted, setSessionSubtasksCompleted] = useState([]);

  useEffect(() => {
    // Fetch tasks from JSON with a 5-second delay
    const fetchData = async () => {
      try {
        const response = await fetch("/tasks.json");
        const data = await response.json();

        // Simulate 2 second delay
        setTimeout(() => {
          setTasks(data.tasks);
          if (data.tasks.length > 0) {
            setSelectedTaskId(data.tasks[0].id);
          }
          setLoading(false);
        }, 2000);
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Close right sidebar when switching views/workspaces
  const [prevViewKey, setPrevViewKey] = useState(() => `${currentView}_${currentProject}`);
  const currentViewKey = `${currentView}_${currentProject}`;
  if (currentViewKey !== prevViewKey) {
    setPrevViewKey(currentViewKey);
    setSelectedTaskId(null);
  }

  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId],
  );

  const toggleDone = (id) => {
    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    if (!taskToToggle.done) {
      const hasUncompletedSubtasks = (taskToToggle.subtasks || []).some(
        (sub) => !sub.done
      );
      if (hasUncompletedSubtasks) {
        alert("You must complete all subtasks before marking this task as completed.");
        return;
      }
    }

    const isRecurring = !!taskToToggle.recurrence;
    const completingNow = !taskToToggle.done;

    if (isRecurring && completingNow && taskToToggle.due) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (taskToToggle.due > todayStr) {
        alert(
          `This recurring task is scheduled for ${taskToToggle.due}. You can only complete it on or after its scheduled date to maintain your streak.`
        );
        return;
      }

      const rec = taskToToggle.recurrence;
      const nowTs = Date.now();

      const newEntry = {
        id: `se_${nowTs}_${Math.random().toString(36).slice(2)}`,
        periodDue: taskToToggle.due,
        completed: true,
        completedAt: nowTs,
        missed: false,
      };

      const newCurrentStreak = (rec.currentStreak || 0) + 1;
      const newMaxStreak = Math.max(rec.maxStreak || 0, newCurrentStreak);
      const nextDue = advanceRecurringTaskDue(
        taskToToggle.due,
        rec.frequency,
        rec.days
      );

      const auditEntry = {
        id: "audit" + nowTs,
        timestamp: nowTs,
        action: "completed",
        details: {},
      };

      const updatedTask = {
        ...taskToToggle,
        done: false, // recurring tasks reset to not-done immediately
        completedAt: null,
        due: nextDue,
        auditLog: [...(taskToToggle.auditLog || []), auditEntry],
        recurrence: {
          ...rec,
          currentStreak: newCurrentStreak,
          maxStreak: newMaxStreak,
          history: [...(rec.history || []), newEntry],
        },
      };

      setTasks(tasks.map((t) => (t.id !== id ? t : updatedTask)));
      return;
    }

    setTasks(
      tasks.map((t) => {
        if (t.id !== id) return t;
        const nowDone = !t.done;
        const auditEntry = {
          id: "audit" + Date.now(),
          timestamp: Date.now(),
          action: nowDone ? "completed" : "uncompleted",
          details: {},
        };
        return {
          ...t,
          done: nowDone,
          completedAt: nowDone ? Date.now() : null,
          auditLog: [...(t.auditLog || []), auditEntry],
        };
      })
    );
  };

  const handleQuickAdd = (title) => {
    if (!title.trim()) return;
    const newTask = {
      id: genId(),
      title,
      project: currentProject || "Inbox",
      due: "",
      est: "0h",
      notes: "",
      done: false,
      target: currentView === "backlog" ? "backlog" : "today",
      subtasks: [],
      sessions: [],
      createdAt: Date.now(),
      completedAt: null,
      auditLog: [
        {
          id: "audit" + Date.now(),
          timestamp: Date.now(),
          action: "created",
          details: {},
        },
      ],
    };
    setTasks([...tasks, newTask]);
    setSelectedTaskId(newTask.id);
  };

  const handleAddTask = (data) => {
    const newTask = {
      id: genId(),
      ...data,
      done: false,
      subtasks: [],
      sessions: [],
      createdAt: Date.now(),
      completedAt: null,
      auditLog: [
        {
          id: "audit" + Date.now(),
          timestamp: Date.now(),
          action: "created",
          details: {},
        },
      ],
    };
    setTasks([...tasks, newTask]);
    setSelectedTaskId(newTask.id);
    if (data.target !== "today" && data.target !== "backlog") {
      setCurrentView(data.target);
    } else if (data.target === "backlog") {
      setCurrentView("backlog");
    } else {
      setCurrentView("today");
    }
  };

  const handleStartTimer = () => {
    if (!selectedTaskId) return;
    setIsTimerNoteModalOpen(true);
  };

  const handleConfirmStartTimer = (note) => {
    setIsTimerNoteModalOpen(false);
    setTimerNote(note);
    setIsTimerRunning(true);
    setActiveSessionStart(Date.now());
    setSessionSubtasksCompleted([]);

    // Audit log entry for timer start
    setTasks(
      tasks.map((t) =>
        t.id === selectedTaskId
          ? {
              ...t,
              auditLog: [
                ...(t.auditLog || []),
                {
                  id: "audit" + Date.now(),
                  timestamp: Date.now(),
                  action: "timer_started",
                  details: { note: note || undefined },
                },
              ],
            }
          : t,
      ),
    );
  };

  const handleStopTimer = () => {
    if (!selectedTaskId || !isTimerRunning) return;
    const endTime = Date.now();
    const durationSec = Math.round((endTime - activeSessionStart) / 1000);
    const newSession = {
      id: "sess" + Date.now(),
      start: activeSessionStart,
      end: endTime,
      note: timerNote || undefined,
      subtasksCompleted: sessionSubtasksCompleted.length > 0 ? [...sessionSubtasksCompleted] : undefined,
    };

    setTasks(
      tasks.map((t) =>
        t.id === selectedTaskId
          ? {
              ...t,
              sessions: [...t.sessions, newSession],
              auditLog: [
                ...(t.auditLog || []),
                {
                  id: "audit" + Date.now() + "s",
                  timestamp: Date.now(),
                  action: "timer_stopped",
                  details: { duration: durationSec, note: timerNote || undefined },
                },
              ],
            }
          : t,
      ),
    );

    setIsTimerRunning(false);
    setTimerSeconds(0);
    setActiveSessionStart(null);
    setTimerNote("");
    setSessionSubtasksCompleted([]);
  };

  const handleToggleSubtask = (taskId, subId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const subtask = task.subtasks.find((s) => s.id === subId);
    if (!subtask) return;

    const willBeCompleted = !subtask.done;
    const subtaskTitle = subtask.title;

    const auditEntry = {
      id: "audit" + Date.now() + Math.floor(Math.random() * 1000),
      timestamp: Date.now(),
      action: willBeCompleted ? "subtask_completed" : "subtask_uncompleted",
      details: { subtaskTitle },
    };

    setTasks(
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subId ? { ...s, done: !s.done } : s,
          ),
          auditLog: [...(t.auditLog || []), auditEntry],
        };
      }),
    );

    // Track subtask completions during active timer session
    if (isTimerRunning && taskId === selectedTaskId && willBeCompleted) {
      setSessionSubtasksCompleted((prev) => [
        ...prev,
        { id: subId, title: subtaskTitle, timestamp: Date.now() },
      ]);
    }
  };

  const handleAddSubtask = (taskId, title) => {
    if (!title.trim()) return;
    const sub = { id: "s" + Date.now(), title: title.trim(), done: false };

    const auditEntry = {
      id: "audit" + Date.now() + "sub",
      timestamp: Date.now(),
      action: "subtask_added",
      details: { subtaskTitle: title.trim() },
    };

    setTasks(
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: [...t.subtasks, sub],
          auditLog: [...(t.auditLog || []), auditEntry],
        };
      }),
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const renderContent = () => {
    if (currentView === "stats") {
      return <DeepStats tasks={tasks} />;
    }
    if (currentView === "timetracking") {
      return <TimeTracking tasks={tasks} isSleeping={isSleeping} sleepStartTime={sleepStartTime} />;
    }
    if (currentView === "scheduled") {
      return (
        <ScheduledView
          tasks={tasks}
          setSelectedTaskId={setSelectedTaskId}
          setCurrentView={setCurrentView}
          showCompleted={settings.showCompleted !== false}
        />
      );
    }

    return (
      <>
        <TaskPanel
          tasks={tasks}
          timeLogs={[]}
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
          selectedTaskId={selectedTaskId}
          setSelectedTaskId={setSelectedTaskId}
          toggleDone={toggleDone}
          handleQuickAdd={handleQuickAdd}
          currentView={currentView}
          currentProject={currentProject}
          projects={projects}
          showCompleted={settings.showCompleted !== false}
          setShowCompleted={(val) =>
            setSettings((s) => ({ ...s, showCompleted: val }))
          }
          isSleeping={isSleeping}
          settings={settings}
          onOpenEditModal={(task) => {
            if (task) setSelectedTaskId(task.id);
            setIsEditModalOpen(true);
          }}
          onDeleteTask={handleDeleteTask}
          onToggleMute={handleToggleMute}
          onUpdateTask={(updatedTask) =>
            setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)))
          }
        />

        <DetailPanel
          selectedTask={selectedTask}
          tasks={tasks}
          setTasks={setTasks}
          onToggleDone={toggleDone}
          isTimerRunning={isTimerRunning}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
          timerSeconds={timerSeconds}
          projects={projects}
          onOpenEditModal={() => setIsEditModalOpen(true)}
          onDeleteTask={handleDeleteTask}
          onToggleMute={handleToggleMute}
          onToggleSubtask={handleToggleSubtask}
          onAddSubtask={handleAddSubtask}
          activeSessionStart={activeSessionStart}
          timerNote={timerNote}
        />
      </>
    );
  };

  return (
    <div
      className="root-container"
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        animation: "contentFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        zoom: settings.appSize / 100,
      }}
    >
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        tasks={tasks}
        currentProject={currentProject}
        setCurrentProject={setCurrentProject}
        projects={projects}
        setProjects={setProjects}
        onAddProject={handleAddProject}
        onDeleteProject={handleDeleteProject}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSleeping={isSleeping}
        setIsSleeping={updateSleeping}
      />

      <div
        className="main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Topbar
          currentView={currentView}
          onOpenModal={() => setIsModalOpen(true)}
          currentProject={currentProject}
          setCurrentProject={setCurrentProject}
          isSleeping={isSleeping}
          setIsSleeping={updateSleeping}
        />

        <div
          className="content"
          style={{ flex: 1, display: "flex", overflow: "hidden" }}
        >
          {renderContent()}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <AddTaskModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onAdd={handleAddTask}
            projects={projects}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            projects={projects}
            setProjects={setProjects}
            settings={settings}
            setSettings={setSettings}
            tasks={tasks}
            setTasks={setTasks}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={handleUpdateProject}
          />
        )}

        {isEditModalOpen && selectedTask && (
          <EditTaskModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            task={selectedTask}
            onSave={handleEditTask}
            onDelete={handleDeleteTask}
            projects={projects}
          />
        )}

        {isTimerNoteModalOpen && (
          <StartTimerModal
            isOpen={isTimerNoteModalOpen}
            onClose={() => setIsTimerNoteModalOpen(false)}
            onStart={handleConfirmStartTimer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Topbar({
  currentView,
  onOpenModal,
  currentProject,
  setCurrentProject,
  isSleeping,
  setIsSleeping,
}) {
  const titles = {
    all: "All Tasks",
    today: "Today",
    archive: "Archive",
    backlog: "Backlog",
    scheduled: "Scheduled",
    timetracking: "Time Tracking",
    stats: "Deep Stats",
    inbox: "Inbox",
  };

  const headerTitle =
    currentProject ||
    titles[currentView] ||
    (currentView.charAt(0).toUpperCase() + currentView.slice(1));

  return (
    <div
      className="topbar"
      style={{
        height: "52px",
        background: "var(--gh-bg)",
        borderBottom: "1px solid var(--gh-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        flexShrink: 0,
      }}
    >
      <div
        className="topbar-title"
        style={{
          fontWeight: "700",
          fontSize: "17px",
          color: "var(--gh-text)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>{headerTitle}</span>
        {currentProject && (
          <span
            onClick={() => setCurrentProject(null)}
            title="Clear project filter"
            style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              color: "var(--gh-muted)",
              cursor: "pointer",
              marginLeft: "4px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "var(--gh-surface2)",
            }}
          >
            ✕
          </span>
        )}
      </div>

      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {isSleeping && (
          <button
            className="btn"
            onClick={() => setIsSleeping(false)}
            style={{
              borderColor: "var(--gh-blue)",
              color: "var(--gh-blue)",
              background: "rgba(88, 166, 255, 0.1)",
            }}
          >
            Wake Up
          </button>
        )}
        <button className="btn btn-primary" onClick={onOpenModal}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{ marginRight: "6px" }}
          >
            <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z" />
          </svg>
          Add Task
        </button>
      </div>
    </div>
  );
}

export default App;
