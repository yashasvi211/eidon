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
import ConfirmationModal from "./components/ConfirmationModal";

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
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("eidon_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse settings from localStorage", e);
      }
    }
    return { appSize: 100 };
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
    setTaskToDelete(null);
  };

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeSessionStart, setActiveSessionStart] = useState(null);

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
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
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
    setIsTimerRunning(true);
    setActiveSessionStart(Date.now());
  };

  const handleStopTimer = () => {
    if (!selectedTaskId || !isTimerRunning) return;
    const endTime = Date.now();
    const newSession = {
      id: "sess" + Date.now(),
      start: activeSessionStart,
      end: endTime,
    };

    setTasks(
      tasks.map((t) =>
        t.id === selectedTaskId
          ? {
              ...t,
              sessions: [...t.sessions, newSession],
            }
          : t,
      ),
    );

    setIsTimerRunning(false);
    setTimerSeconds(0);
    setActiveSessionStart(null);
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
          onDeleteTask={() => setTaskToDelete(selectedTask)}
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

        {taskToDelete && (
          <ConfirmationModal
            isOpen={!!taskToDelete}
            onClose={() => setTaskToDelete(null)}
            onConfirm={() => handleDeleteTask(taskToDelete.id)}
            title="Delete Task"
            message={`Are you sure you want to delete "${taskToDelete?.title}"? This action cannot be undone.`}
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
