import React, { useState, useEffect, useMemo } from "react";
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

// ============================================================
// UTILITIES
// ============================================================
const fmtDateISO = (d) => {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

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
        return { showCompleted: true, ...parsed };
      } catch (e) {
        console.error("Failed to parse settings from localStorage", e);
      }
    }
    return { appSize: 100, showCompleted: true };
  });

  useEffect(() => {
    localStorage.setItem("eidon_settings", JSON.stringify(settings));
  }, [settings]);

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

  const handleEditTask = (taskId, changes, reason) => {
    setTasks(
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const newAuditEntries = [];
        const updated = { ...t };

        if ("due" in changes) {
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

        if ("est" in changes) {
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
      }),
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
      return <TimeTracking tasks={tasks} />;
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
        />

        <DetailPanel
          selectedTask={selectedTask}
          tasks={tasks}
          setTasks={setTasks}
          isTimerRunning={isTimerRunning}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
          timerSeconds={timerSeconds}
          projects={projects}
          onOpenEditModal={() => setIsEditModalOpen(true)}
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
          tasks={tasks}
          onOpenModal={() => setIsModalOpen(true)}
          currentProject={currentProject}
          setCurrentProject={setCurrentProject}
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
            onDeleteProject={handleDeleteProject}
          />
        )}

        {isEditModalOpen && selectedTask && (
          <EditTaskModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            task={selectedTask}
            onSave={handleEditTask}
            onDelete={handleDeleteTask}
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
  tasks,
  onOpenModal,
  currentProject,
  setCurrentProject,
}) {
  const titles = {
    today: "Today's Tasks",
    scheduled: "Scheduled Calendar",
    timetracking: "Time Tracking Record",
    stats: "Deep Stats",
    backlog: "Backlog",
  };

  return (
    <div
      className="topbar"
      style={{
        height: "48px",
        background: "var(--gh-surface)",
        borderBottom: "1px solid var(--gh-border)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "0 16px",
        flexShrink: 0,
      }}
    >
      <div
        className="topbar-title"
        style={{
          fontWeight: "600",
          fontSize: "15px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {currentProject || titles[currentView] || currentView}
        {currentProject && (
          <span
            onClick={() => setCurrentProject(null)}
            style={{
              fontFamily: "var(--mono)",
              fontSize: "10px",
              color: "var(--gh-muted)",
              cursor: "pointer",
              marginLeft: "4px",
            }}
          >
            ✕
          </span>
        )}
      </div>
      <span className="topbar-sep" style={{ color: "var(--gh-border2)" }}>
        —
      </span>
      <div
        className="topbar-breadcrumb"
        style={{
          fontFamily: "var(--mono)",
          fontSize: "12px",
          color: "var(--gh-muted)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span>
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span style={{ color: "var(--gh-border2)" }}>·</span>
        <span style={{ color: "var(--gh-green)" }}>
          {tasks.filter((t) => t.target === "today" && !t.done).length} tasks
          remaining
        </span>
      </div>
      <div className="topbar-actions" style={{ marginLeft: "auto" }}>
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
