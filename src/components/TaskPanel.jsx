import { useState } from "react";
import TaskItem from "./TaskItem";
import TaskOptionsModal from "./TaskOptionsModal";
import { getInitialRecurringDueDate } from "../utils/reminderUtils";

export default function TaskPanel({
  tasks = [],
  selectedTaskId,
  setSelectedTaskId,
  currentView = "today",
  currentProject = null,
  projects = [],
  showCompleted = true,
  setShowCompleted,
  onOpenEditModal,
  onDeleteTask,
  onToggleMute,
  onUpdateTask,
}) {
  const [optionsTask, setOptionsTask] = useState(null);
  const [localShowCompleted, setLocalShowCompleted] = useState(showCompleted);

  const isCompletedVisible =
    setShowCompleted !== undefined ? showCompleted : localShowCompleted;

  const handleToggleCompleted = () => {
    if (setShowCompleted) {
      setShowCompleted(!showCompleted);
    } else {
      setLocalShowCompleted(!localShowCompleted);
    }
  };

  const handleOpenOptions = (task) => {
    setOptionsTask(task);
  };

  const handleCloseOptions = () => {
    setOptionsTask(null);
  };

  const handleUpdate = () => {
    if (!optionsTask) return;
    const taskToEdit = optionsTask;
    setOptionsTask(null);
    if (onOpenEditModal) {
      onOpenEditModal(taskToEdit);
    }
  };

  const handleDelete = () => {
    if (!optionsTask) return;
    const idToDelete = optionsTask.id;
    setOptionsTask(null);
    if (onDeleteTask) {
      onDeleteTask(idToDelete);
    }
  };

  const handleToggleMute = () => {
    if (!optionsTask) return;
    const idToMute = optionsTask.id;
    setOptionsTask(null);
    if (onToggleMute) {
      onToggleMute(idToMute);
    } else if (onUpdateTask) {
      onUpdateTask({ ...optionsTask, muted: !optionsTask.muted });
    }
  };

  const getProjectColor = (pName) => {
    const found = projects.find((proj) => proj.name === pName);
    return found ? found.color : "#bc8cff";
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const isTaskOverdue = (t) => {
    const effectiveDue =
      t.due ||
      (t.recurrence
        ? getInitialRecurringDueDate(
            t.recurrence.frequency,
            t.recurrence.days,
            t.dueTime
          )
        : null);
    if (t.done || !effectiveDue) return false;
    const nowObj = new Date();
    const dueObj = new Date(effectiveDue + "T00:00:00");
    if (t.dueTime && t.dueTime.trim() !== "") {
      const [h, m] = t.dueTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) dueObj.setHours(h, m, 0, 0);
    } else {
      dueObj.setHours(23, 59, 59, 999);
    }
    return nowObj.getTime() > dueObj.getTime();
  };

  const isExecStartReached = (t) => {
    if (!t.execStartDate) return false;
    const execObj = new Date(t.execStartDate + "T00:00:00");
    if (t.execStartTime && t.execStartTime.trim() !== "") {
      const [h, m] = t.execStartTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) execObj.setHours(h, m, 0, 0);
    } else {
      execObj.setHours(0, 0, 0, 0);
    }
    return now.getTime() >= execObj.getTime();
  };

  const isTaskCurrent = (t) => {
    if (t.target === "backlog") return false;
    const effectiveDue =
      t.due ||
      (t.recurrence
        ? getInitialRecurringDueDate(
            t.recurrence.frequency,
            t.recurrence.days,
            t.dueTime
          )
        : null);
    if (!effectiveDue) return false;
    if (isTaskOverdue(t)) return false;
    if (t.execStartDate) {
      return isExecStartReached(t);
    }
    return effectiveDue === todayStr;
  };

  const isTaskArchive = (t) => {
    const effectiveDue =
      t.due ||
      (t.recurrence
        ? getInitialRecurringDueDate(
            t.recurrence.frequency,
            t.recurrence.days,
            t.dueTime
          )
        : null);
    return !effectiveDue;
  };

  const isTaskBacklog = (t) => {
    if (t.target === "backlog") return true;
    if (isTaskOverdue(t)) return true;
    return false;
  };

  const uniqTasks = tasks.filter(
    (t, idx, self) => self.findIndex((x) => x.id === t.id) === idx
  );

  const baseFiltered = uniqTasks
    .filter((t) => {
      if (currentProject) return t.project === currentProject;
      if (currentView === "inbox") return t.project === "Inbox";
      if (currentView === "all") return true;
      if (currentView === "today") return isTaskCurrent(t);
      if (currentView === "archive") return isTaskArchive(t);
      if (currentView === "backlog") return isTaskBacklog(t);
      return t.target === currentView;
    })
    .sort((a, b) => {
      const getPriorityWeight = (priority) => {
        if (priority === "High") return 3;
        if (priority === "Moderate") return 2;
        if (priority === "Low") return 1;
        return 0;
      };
      return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    });

  const activeTasks = baseFiltered.filter((t) => !t.done);
  const completedTasks = baseFiltered.filter((t) => t.done);

  let taskCounter = 1;

  const renderTask = (t, index) => (
    <TaskItem
      key={t.id}
      task={t}
      index={index}
      active={selectedTaskId === t.id}
      onSelect={() => setSelectedTaskId(t.id)}
      onOptions={handleOpenOptions}
      projects={projects}
    />
  );

  const renderCompletedSection = () => {
    if (completedTasks.length === 0) return null;
    return (
      <div className="completed-section" style={{ marginTop: "12px" }}>
        <div
          className="completed-header"
          onClick={handleToggleCompleted}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 16px 6px",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: "700",
            color: "var(--gh-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            userSelect: "none",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isCompletedVisible ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Completed ({completedTasks.length})</span>
        </div>
        {isCompletedVisible &&
          completedTasks.map((t) => renderTask(t, taskCounter++))}
      </div>
    );
  };

  const renderContent = () => {
    if (!currentProject && currentView === "all") {
      const byProject = activeTasks.reduce((acc, t) => {
        if (!acc[t.project]) acc[t.project] = [];
        acc[t.project].push(t);
        return acc;
      }, {});

      const projectNames = Object.keys(byProject).sort();

      if (activeTasks.length === 0 && completedTasks.length === 0) {
        return (
          <div
            style={{
              padding: "32px 16px",
              color: "var(--gh-muted)",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            No tasks found.
          </div>
        );
      }

      return (
        <div>
          {projectNames.map((pName) => {
            const color = getProjectColor(pName);
            return (
              <div key={pName} className="project-group-section">
                <div
                  style={{
                    padding: "10px 16px 6px",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: color,
                    }}
                  />
                  <span>{pName}</span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      opacity: 0.7,
                    }}
                  >
                    ({byProject[pName].length})
                  </span>
                </div>
                {byProject[pName].map((t) => renderTask(t, taskCounter++))}
              </div>
            );
          })}
          {renderCompletedSection()}
        </div>
      );
    }

    if (currentProject) {
      const overdueTasks = activeTasks.filter(isTaskOverdue);
      const currentTasks = activeTasks.filter(isTaskCurrent);
      const archiveTasks = activeTasks.filter(isTaskArchive);
      const futureTasks = activeTasks.filter(
        (t) => !isTaskOverdue(t) && !isTaskCurrent(t) && !isTaskArchive(t)
      );

      if (activeTasks.length === 0 && completedTasks.length === 0) {
        return (
          <div
            style={{
              padding: "32px 16px",
              color: "var(--gh-muted)",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            No tasks in this project.
          </div>
        );
      }

      return (
        <div>
          {overdueTasks.length > 0 && (
            <div className="project-section">
              <div
                style={{
                  padding: "10px 16px 6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--gh-red)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>! Overdue</span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    opacity: 0.8,
                  }}
                >
                  ({overdueTasks.length})
                </span>
              </div>
              {overdueTasks.map((t) => renderTask(t, taskCounter++))}
            </div>
          )}

          {currentTasks.length > 0 && (
            <div className="project-section">
              <div
                style={{
                  padding: "10px 16px 6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Current / Today ({currentTasks.length})
              </div>
              {currentTasks.map((t) => renderTask(t, taskCounter++))}
            </div>
          )}

          {archiveTasks.length > 0 && (
            <div className="project-section">
              <div
                style={{
                  padding: "10px 16px 6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Archive (No Deadline) ({archiveTasks.length})
              </div>
              {archiveTasks.map((t) => renderTask(t, taskCounter++))}
            </div>
          )}

          {futureTasks.length > 0 && (
            <div className="project-section">
              <div
                style={{
                  padding: "10px 16px 6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Scheduled / Future ({futureTasks.length})
              </div>
              {futureTasks.map((t) => renderTask(t, taskCounter++))}
            </div>
          )}

          {renderCompletedSection()}
        </div>
      );
    }

    // Other views (today, archive, backlog, inbox, etc.)
    if (activeTasks.length === 0 && completedTasks.length === 0) {
      return (
        <div
          style={{
            padding: "32px 16px",
            color: "var(--gh-muted)",
            fontSize: "13px",
            textAlign: "center",
          }}
        >
          No tasks found here.
        </div>
      );
    }

    return (
      <div>
        {activeTasks.map((t) => renderTask(t, taskCounter++))}
        {renderCompletedSection()}
      </div>
    );
  };

  return (
    <div
      className="task-panel"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--gh-border)",
        overflow: "hidden",
      }}
    >
      <div
        className="task-list"
        style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}
      >
        {renderContent()}
      </div>

      {/* Task Options Modal */}
      <TaskOptionsModal
        isOpen={!!optionsTask}
        onClose={handleCloseOptions}
        isMuted={!!optionsTask?.muted}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
}

