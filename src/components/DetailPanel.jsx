import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import TaskOptionsModal from "./TaskOptionsModal";
import {
  getInitialRecurringDueDate,
  formatRecurrenceSchedule,
  formatEstimateDisplay,
  formatTime12h,
  advanceRecurringTaskDue,
} from "../utils/reminderUtils";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
};

const getSubtaskProgressInfo = (done, total) => {
  if (total === 0) return { color: "var(--gh-muted)", pct: 0 };
  const pct = Math.round((done / total) * 100);
  if (pct === 0) return { color: "#f85149", pct };
  if (pct < 40) return { color: "#f0883e", pct };
  if (pct < 70) return { color: "#d29922", pct };
  if (pct < 100) return { color: "#56d4dd", pct };
  return { color: "#3fb950", pct };
};

const fmtTimer = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

const fmtRelativeTime = (timestamp) => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + "d ago";
  return new Date(timestamp).toLocaleDateString();
};

const fmtFullDate = (timestamp) => {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const AUDIT_ICONS = {
  created: { icon: "🟢", label: "Task created", color: "#3fb950" },
  completed: { icon: "✅", label: "Task completed", color: "#3fb950" },
  uncompleted: { icon: "🔄", label: "Task reopened", color: "#f0883e" },
  due_changed: { icon: "📅", label: "Due date changed", color: "#58a6ff" },
  estimate_changed: { icon: "⏱", label: "Estimate updated", color: "#d29922" },
  timer_started: { icon: "▶️", label: "Timer started", color: "#3fb950" },
  timer_stopped: { icon: "⏹️", label: "Timer stopped", color: "#f85149" },
  subtask_completed: { icon: "☑️", label: "Subtask completed", color: "#3fb950" },
  subtask_uncompleted: { icon: "⬜", label: "Subtask reopened", color: "#f0883e" },
  subtask_added: { icon: "➕", label: "Subtask added", color: "#58a6ff" },
  notes_updated: { icon: "📝", label: "Notes updated", color: "#bc8cff" },
  task_updated: { icon: "✏️", label: "Task updated", color: "#58a6ff" },
  time_logged: { icon: "⏱", label: "Time logged", color: "#3fb950" },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function DetailSection({ label, children, action }) {
  return (
    <div className="detail-section" style={{ marginBottom: "20px" }}>
      <div
        className="detail-section-label"
        style={{
          fontFamily: "var(--mono)",
          fontSize: "10px",
          color: "var(--gh-muted)",
          textTransform: "uppercase",
          marginBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Slide to Start Component ───────────────────────────────────────────────

function SlideToStart({ onSlideComplete }) {
  const [position, setPosition] = useState(0);
  const isDraggingRef = useRef(false);
  const trackRef = useRef(null);
  const onCompleteRef = useRef(onSlideComplete);

  useEffect(() => {
    onCompleteRef.current = onSlideComplete;
  }, [onSlideComplete]);

  const thumbSize = 44;
  const pad = 4;
  const threshold = 0.82;

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDraggingRef.current || !trackRef.current) return;
      const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
      const rect = trackRef.current.getBoundingClientRect();
      const maxTravel = rect.width - thumbSize - pad * 2;
      const rawPos = (clientX - rect.left - pad - thumbSize / 2) / maxTravel;
      setPosition(Math.max(0, Math.min(1, rawPos)));
    };

    const handleEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setPosition((prev) => {
        if (prev >= threshold) {
          setTimeout(() => onCompleteRef.current?.(), 50);
        }
        return 0;
      });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, []);

  const thumbLeft = `calc(${pad}px + ${position} * (100% - ${thumbSize + pad * 2}px))`;
  const trailWidth = `calc(${pad + thumbSize}px + ${position} * (100% - ${thumbSize + pad * 2}px))`;

  return (
    <div
      ref={trackRef}
      className="slide-track"
      style={{
        position: "relative",
        height: `${thumbSize + pad * 2}px`,
        background: "var(--gh-surface2)",
        borderRadius: `${(thumbSize + pad * 2) / 2}px`,
        border: "1px solid var(--gh-border)",
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {/* Gradient trail */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: trailWidth,
          background: "linear-gradient(90deg, rgba(63,185,80,0.2), rgba(63,185,80,0.05))",
          borderRadius: `${(thumbSize + pad * 2) / 2}px`,
          transition: position === 0 ? "width 0.4s cubic-bezier(0.16,1,0.3,1)" : "none",
        }}
      />

      {/* Label text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--mono)",
          fontSize: "12px",
          color: "var(--gh-muted)",
          opacity: Math.max(0, 1 - position * 2),
          transition: position === 0 ? "opacity 0.4s ease" : "none",
          pointerEvents: "none",
          letterSpacing: "0.5px",
        }}
      >
        Slide to start →
      </div>

      {/* Draggable thumb */}
      <div
        className="slide-thumb"
        onMouseDown={(e) => {
          e.preventDefault();
          isDraggingRef.current = true;
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          isDraggingRef.current = true;
        }}
        style={{
          position: "absolute",
          left: thumbLeft,
          top: `${pad}px`,
          width: `${thumbSize}px`,
          height: `${thumbSize}px`,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--gh-green), var(--gh-green-dim))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          transition:
            position === 0
              ? "left 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease"
              : "box-shadow 0.2s ease",
          boxShadow:
            position > 0
              ? "0 4px 16px rgba(63,185,80,0.4)"
              : "0 2px 8px rgba(63,185,80,0.25)",
          zIndex: 2,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DetailPanel({
  selectedTask,
  tasks,
  setTasks,
  isTimerRunning,
  onStartTimer,
  onStopTimer,
  timerSeconds,
  projects = [],
  onOpenEditModal,
  onDeleteTask,
  onToggleMute,
  onToggleSubtask,
  onAddSubtask,
  onToggleDone,
  timerNote,
}) {
  const projectColor = (p) => {
    const found = projects.find((proj) => proj.name === p);
    return found ? found.color : "#8b949e";
  };

  const [activeTab, setActiveTab] = useState("details");
  const [newSubtask, setNewSubtask] = useState("");
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotesText, setEditedNotesText] = useState(() => selectedTask?.notes || "");
  const [isLoggingTime, setIsLoggingTime] = useState(false);
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualNote, setManualNote] = useState("");

  const [nowTime, setNowTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [prevTaskId, setPrevTaskId] = useState(() => selectedTask?.id);
  if (selectedTask?.id !== prevTaskId) {
    setPrevTaskId(selectedTask?.id);
    setIsEditingNotes(false);
    setEditedNotesText(selectedTask?.notes || "");
  }

  const handleToggleDone = () => {
    if (!selectedTask) return;
    if (onToggleDone) {
      onToggleDone(selectedTask.id);
      return;
    }
    const isDone = !selectedTask.done;
    const now = Date.now();
    const newAudit = {
      id: "a" + now,
      timestamp: now,
      action: isDone ? "completed" : "uncompleted",
    };
    const updated = {
      ...selectedTask,
      done: isDone,
      completedAt: isDone ? now : null,
      auditLog: [...(selectedTask.auditLog || []), newAudit],
    };
    if (setTasks && tasks) {
      setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
    }
  };

  const handleSaveNotes = () => {
    if (!selectedTask) return;
    const now = Date.now();
    const newAudit = {
      id: "a" + now,
      timestamp: now,
      action: "notes_updated",
      details: {
        notePreview: editedNotesText.slice(0, 60),
      },
    };
    const updated = {
      ...selectedTask,
      notes: editedNotesText,
      auditLog: [...(selectedTask.auditLog || []), newAudit],
    };
    if (setTasks && tasks) {
      setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
    }
    setIsEditingNotes(false);
  };

  const handleDeleteSubtask = (subtaskId) => {
    if (!selectedTask) return;
    const sub = (selectedTask.subtasks || []).find((s) => s.id === subtaskId);
    const updatedSubtasks = (selectedTask.subtasks || []).filter(
      (s) => s.id !== subtaskId
    );
    const now = Date.now();
    const newAudit = {
      id: "a" + now,
      timestamp: now,
      action: "subtask_uncompleted",
      details: {
        subtaskTitle: sub?.title || "Subtask",
      },
    };
    const updated = {
      ...selectedTask,
      subtasks: updatedSubtasks,
      auditLog: [...(selectedTask.auditLog || []), newAudit],
    };
    if (setTasks && tasks) {
      setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
    }
  };

  const handleManualLogTime = () => {
    const h = parseInt(manualHours, 10) || 0;
    const m = parseInt(manualMinutes, 10) || 0;
    const totalSecs = h * 3600 + m * 60;
    if (totalSecs <= 0) return;

    const now = Date.now();
    const newSession = {
      id: "s" + now,
      start: now - totalSecs * 1000,
      end: now,
      note: manualNote.trim() || undefined,
    };
    const newAudit = {
      id: "a" + now,
      timestamp: now,
      action: "time_logged",
      details: {
        duration: totalSecs,
        note: manualNote.trim() || undefined,
      },
    };
    const updated = {
      ...selectedTask,
      sessions: [...(selectedTask.sessions || []), newSession],
      auditLog: [...(selectedTask.auditLog || []), newAudit],
    };
    if (setTasks && tasks) {
      setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
    }
    setManualHours("");
    setManualMinutes("");
    setManualNote("");
    setIsLoggingTime(false);
  };

  if (!selectedTask)
    return (
      <div
        className="detail-panel"
        style={{
          width: "400px",
          background: "var(--gh-surface)",
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid var(--gh-border)",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "40px 20px",
            color: "var(--gh-muted)",
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </motion.svg>
          </motion.div>
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: "14px",
              fontWeight: 500,
              textAlign: "center",
              lineHeight: "1.5",
            }}
          >
            Select a task to see details
          </motion.div>
        </div>
      </div>
    );

  const totalSpent = (selectedTask.sessions || []).reduce(
    (acc, sess) => acc + (sess.end - sess.start) / 1000,
    0,
  );
  const subtasks = selectedTask.subtasks || [];
  const totalSubs = subtasks.length;
  const doneSubs = subtasks.filter((s) => s.done).length;
  const progressInfo = getSubtaskProgressInfo(doneSubs, totalSubs);

  const toggleSessionExpanded = (sessId) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessId)) next.delete(sessId);
      else next.add(sessId);
      return next;
    });
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    onAddSubtask(selectedTask.id, newSubtask);
    setNewSubtask("");
  };

  const effectiveDue =
    selectedTask.due ||
    (selectedTask.recurrence
      ? getInitialRecurringDueDate(
          selectedTask.recurrence.frequency,
          selectedTask.recurrence.days,
          selectedTask.dueTime
        )
      : null);

  let dueObj = null;
  let dueFormatted = "—";
  if (effectiveDue) {
    dueObj = new Date(effectiveDue + "T00:00:00");
    if (selectedTask.dueTime && selectedTask.dueTime.trim() !== "") {
      const [h, m] = selectedTask.dueTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) dueObj.setHours(h, m, 0, 0);
    } else {
      dueObj.setHours(23, 59, 59, 999);
    }
    dueFormatted = fmtFullDate(dueObj.getTime());
  }

  const diffMs = dueObj ? dueObj.getTime() - nowTime : null;
  const isOverdue = diffMs !== null && diffMs < 0 && !selectedTask.done;

  let overdueDurationStr = "";
  let timeLeftStr = "";
  if (diffMs !== null && !selectedTask.done) {
    if (diffMs < 0) {
      const overMs = Math.abs(diffMs);
      const overDays = Math.floor(overMs / (1000 * 60 * 60 * 24));
      const overHours = Math.floor(
        (overMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const overMins = Math.floor((overMs % (1000 * 60 * 60)) / (1000 * 60));
      const overSecs = Math.floor((overMs / 1000) % 60);
      if (overDays > 0) overdueDurationStr = `${overDays}d ${overHours}h`;
      else if (overHours > 0) overdueDurationStr = `${overHours}h ${overMins}m`;
      else overdueDurationStr = `${overMins}m ${overSecs}s`;
    } else {
      const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diffMs / 1000 / 60) % 60);
      const s = Math.floor((diffMs / 1000) % 60);
      if (d > 0) timeLeftStr = `${d}d ${h}h ${m}m`;
      else if (h > 0) timeLeftStr = `${h}h ${m}m ${s}s`;
      else timeLeftStr = `${m}m ${s}s`;
    }
  }

  let nextCycleFormatted = "";
  if (selectedTask.recurrence && effectiveDue) {
    const nextDueStr = advanceRecurringTaskDue(
      effectiveDue,
      selectedTask.recurrence.frequency,
      selectedTask.recurrence.days
    );
    const [nxY, nxM, nxD] = nextDueStr.split("-").map(Number);
    const nxObj = new Date(nxY, nxM - 1, nxD, 0, 0, 0, 0);
    if (selectedTask.dueTime && selectedTask.dueTime.trim() !== "") {
      const [h, m] = selectedTask.dueTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) nxObj.setHours(h, m, 0, 0);
    } else {
      nxObj.setHours(23, 59, 59, 999);
    }
    nextCycleFormatted = fmtFullDate(nxObj.getTime());
  }

  const p = selectedTask.priority || "Low";
  const priorityColor =
    p === "High"
      ? "var(--gh-red)"
      : p === "Moderate"
      ? "var(--gh-amber)"
      : "var(--gh-green)";
  const priorityBg =
    p === "High"
      ? "rgba(248, 81, 73, 0.12)"
      : p === "Moderate"
      ? "rgba(210, 153, 34, 0.12)"
      : "rgba(63, 185, 80, 0.12)";
  const priorityBorder =
    p === "High"
      ? "rgba(248, 81, 73, 0.3)"
      : p === "Moderate"
      ? "rgba(210, 153, 34, 0.3)"
      : "rgba(63, 185, 80, 0.3)";
  const priorityIcon = p === "High" ? "↑" : p === "Moderate" ? "•" : "↓";

  const attributeRows = [];
  attributeRows.push({
    icon: "🟢",
    label: "Created",
    value: selectedTask.createdAt ? fmtFullDate(selectedTask.createdAt) : "—",
  });
  if (selectedTask.completedAt) {
    attributeRows.push({
      icon: "✓",
      label: "Completed",
      value: fmtFullDate(selectedTask.completedAt),
      color: "var(--gh-green)",
    });
  }
  if (selectedTask.recurrence) {
    attributeRows.push({
      icon: "↻",
      label: "Recurrence",
      value: formatRecurrenceSchedule(
        selectedTask.recurrence.frequency,
        selectedTask.recurrence.days
      ),
      color: "var(--gh-blue)",
    });
    if (isOverdue) {
      attributeRows.push({
        icon: "⚠️",
        label: "Overdue Deadline",
        value: dueFormatted,
        color: "var(--gh-red)",
        weight: "700",
      });
      if (nextCycleFormatted) {
        attributeRows.push({
          icon: "📅",
          label: "Next Occurrence",
          value: nextCycleFormatted,
          color: "var(--gh-blue)",
        });
      }
    } else {
      attributeRows.push({
        icon: "📅",
        label: "Next Deadline",
        value: dueFormatted,
        color: "var(--gh-text)",
      });
    }
  } else {
    attributeRows.push({
      icon: "📅",
      label: "Due",
      value: dueFormatted,
      color: isOverdue ? "var(--gh-red)" : "var(--gh-text)",
    });
  }

  if (timeLeftStr) {
    attributeRows.push({
      icon: "⏱",
      label: "Time Left",
      value: timeLeftStr,
      color: "var(--gh-blue)",
      weight: "600",
    });
  }
  if (overdueDurationStr) {
    attributeRows.push({
      icon: "⚠️",
      label: "Overdue Time",
      value: overdueDurationStr,
      color: "var(--gh-red)",
      weight: "700",
    });
  }

  const tabs = [
    {
      id: "details",
      label: "Details",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: "checklist",
      label: "Checklist",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      id: "timetracking",
      label: "Time",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: "history",
      label: "History",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="12 8 12 12 14 14" />
          <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="detail-panel"
      style={{
        width: "400px",
        background: "var(--gh-surface)",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--gh-border)",
      }}
    >
      {/* ─── Header ─── */}
      <div
        className="detail-header"
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--gh-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            className="detail-title"
            style={{ fontSize: "15px", fontWeight: "600", flex: 1, marginRight: "8px" }}
          >
            {selectedTask.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <button
              className="btn"
              onClick={onOpenEditModal}
              title="Edit Task"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              className="btn"
              onClick={() => setOptionsModalVisible(true)}
              title="Task options"
              aria-label="Task options"
              style={{ padding: "6px 8px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Timer badge in header when running */}
        {isTimerRunning && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "8px",
              padding: "4px 10px",
              background: "rgba(63,185,80,0.06)",
              borderRadius: "8px",
              border: "1px solid rgba(63,185,80,0.15)",
            }}
          >
            <span className="timer-pulse-dot" />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "13px",
                color: "var(--gh-green)",
                fontWeight: "600",
              }}
            >
              {fmtTimer(timerSeconds)}
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "var(--gh-muted)",
                fontFamily: "var(--mono)",
              }}
            >
              tracking
            </span>
          </div>
        )}
      </div>

      {/* ─── Tab Bar ─── */}
      <div className="detail-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`detail-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}
      <div
        className="detail-body"
        style={{ flex: 1, overflowY: "auto", padding: "16px" }}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            DETAILS TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "details" && (
          <>
            {/* ── Streak Banner for recurring tasks ── */}
            {selectedTask.recurrence?.streakEnabled && (() => {
              const rec = selectedTask.recurrence;
              const schedDesc = formatRecurrenceSchedule(rec.frequency, rec.days);
              return (
                <div
                  style={{
                    backgroundColor: "rgba(240, 136, 62, 0.07)",
                    border: "1px solid rgba(240, 136, 62, 0.22)",
                    borderRadius: "12px",
                    padding: "12px",
                    marginBottom: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(240, 136, 62, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#f0883e",
                      fontSize: "18px",
                      fontWeight: "800",
                      flexShrink: 0,
                    }}
                  >
                    ★
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f0883e", fontSize: "13px", fontWeight: "700" }}>
                      {rec.currentStreak > 0 ? `${rec.currentStreak} streak!` : "Start your streak today!"}
                    </div>
                    <div style={{ color: "var(--gh-muted)", fontSize: "11px", marginTop: "1px" }}>
                      Best: {rec.maxStreak || 0} • {schedDesc || `${rec.frequency} recurring`}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "rgba(240, 136, 62, 0.15)",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      color: "#f0883e",
                      fontSize: "11px",
                      fontWeight: "700",
                      flexShrink: 0,
                    }}
                  >
                    ★ {rec.maxStreak || 0} best
                  </div>
                </div>
              );
            })()}

            {/* ── Overdue Alert Banner / Card ── */}
            {isOverdue && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  backgroundColor: "rgba(248, 81, 73, 0.12)",
                  border: "1px solid rgba(248, 81, 73, 0.35)",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "var(--gh-red)",
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 2" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--gh-red)", fontWeight: "700", fontSize: "14px", marginBottom: "2px" }}>
                    ! Task is Overdue by {overdueDurationStr}
                  </div>
                  <div style={{ color: "var(--gh-muted)", fontSize: "12px" }}>
                    {selectedTask.recurrence ? "Deadline was " : "Due date was "}
                    {dueFormatted}
                  </div>
                </div>
              </div>
            )}

            {/* ── Status & Priority Row ── */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              {/* Status Card */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: selectedTask.done ? "rgba(63, 185, 80, 0.08)" : "var(--gh-surface)",
                  border: `1px solid ${selectedTask.done ? "rgba(63, 185, 80, 0.3)" : "var(--gh-border)"}`,
                  borderRadius: "12px",
                  padding: "14px",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "8px",
                      backgroundColor: selectedTask.done ? "rgba(63, 185, 80, 0.15)" : "rgba(139, 148, 158, 0.12)",
                      color: selectedTask.done ? "var(--gh-green)" : "var(--gh-muted)",
                      fontWeight: "700",
                    }}
                  >
                    {selectedTask.done ? "✓" : "○"}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    STATUS
                  </span>
                </div>
                <button
                  onClick={handleToggleDone}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    backgroundColor: selectedTask.done ? "rgba(63, 185, 80, 0.12)" : "var(--gh-surface2)",
                    border: `1px solid ${selectedTask.done ? "rgba(63, 185, 80, 0.3)" : "var(--gh-border)"}`,
                    cursor: "pointer",
                    color: selectedTask.done ? "var(--gh-green)" : "var(--gh-text)",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      border: `1.5px solid ${selectedTask.done ? "var(--gh-green)" : "var(--gh-border2)"}`,
                      backgroundColor: selectedTask.done ? "var(--gh-green)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "10px",
                    }}
                  >
                    {selectedTask.done && "✓"}
                  </div>
                  <span>{selectedTask.done ? "Completed" : "Mark complete"}</span>
                </button>
              </div>

              {/* Priority Card */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "var(--gh-surface)",
                  border: "1px solid var(--gh-border)",
                  borderRadius: "12px",
                  padding: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "8px",
                      backgroundColor: priorityBg,
                      color: priorityColor,
                      fontWeight: "700",
                      fontSize: "14px",
                    }}
                  >
                    {priorityIcon}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    PRIORITY
                  </span>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    backgroundColor: priorityBg,
                    border: `1px solid ${priorityBorder}`,
                    color: priorityColor,
                    fontWeight: "700",
                    fontSize: "13px",
                  }}
                >
                  {p}
                </div>
              </div>
            </div>

            {/* ── Recurring Task Schedule Card ── */}
            {selectedTask.recurrence && (() => {
              const rec = selectedTask.recurrence;
              const freq = (rec.frequency || "daily").toLowerCase();
              const freqLabel =
                freq === "daily"
                  ? "Daily"
                  : freq === "weekly"
                  ? "Weekly"
                  : freq === "monthly"
                  ? "Monthly"
                  : freq;
              const scheduleSummary = formatRecurrenceSchedule(freq, rec.days);
              const deadlineTimeFormatted = selectedTask.dueTime
                ? formatTime12h(selectedTask.dueTime)
                : null;
              const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

              return (
                <div
                  style={{
                    backgroundColor: "var(--gh-surface)",
                    border: `1px solid ${isOverdue ? "rgba(248, 81, 73, 0.3)" : "rgba(88, 166, 255, 0.25)"}`,
                    borderRadius: "12px",
                    padding: "14px",
                    marginBottom: "16px",
                  }}
                >
                  {/* Header Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div
                        style={{
                          backgroundColor: isOverdue ? "rgba(248, 81, 73, 0.12)" : "rgba(88, 166, 255, 0.12)",
                          width: "28px",
                          height: "28px",
                          borderRadius: "7px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: "8px",
                          color: isOverdue ? "var(--gh-red)" : "var(--gh-blue)",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        RECURRING SCHEDULE
                      </span>
                    </div>
                    <div
                      style={{
                        backgroundColor: isOverdue ? "rgba(248, 81, 73, 0.12)" : "rgba(88, 166, 255, 0.12)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        color: isOverdue ? "var(--gh-red)" : "var(--gh-blue)",
                        fontSize: "11px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      {isOverdue ? `${freqLabel} • Overdue` : freqLabel}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div
                    style={{
                      backgroundColor: "var(--gh-surface2)",
                      borderRadius: "8px",
                      padding: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ color: isOverdue ? "var(--gh-red)" : "var(--gh-blue)" }}>📅</span>
                      <span style={{ color: "var(--gh-text)", fontSize: "13px", fontWeight: "700" }}>
                        {scheduleSummary}
                      </span>
                    </div>
                    <div style={{ color: "var(--gh-muted)", fontSize: "11px" }}>
                      {freq === "daily"
                        ? "Applies every day — resets automatically on completion or cycle rollover."
                        : freq === "weekly"
                        ? "Applies on selected days of the week — advances to next scheduled day."
                        : "Applies on selected dates of the month — advances to next scheduled date."}
                    </div>
                  </div>

                  {/* Weekly Days Indicator Chips */}
                  {freq === "weekly" && (
                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          color: "var(--gh-muted)",
                          fontSize: "11px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          marginBottom: "6px",
                        }}
                      >
                        Active Days
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {DAY_ABBR.map((dayName, idx) => {
                          const isActive =
                            !rec.days || rec.days.length === 0 || rec.days.includes(idx);
                          return (
                            <div
                              key={dayName}
                              style={{
                                width: "32px",
                                height: "28px",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isActive
                                  ? "rgba(88, 166, 255, 0.15)"
                                  : "var(--gh-surface2)",
                                border: `1px solid ${isActive ? "var(--gh-blue)" : "var(--gh-border)"}`,
                                fontSize: "11px",
                                fontWeight: isActive ? "700" : "400",
                                color: isActive ? "var(--gh-blue)" : "var(--gh-muted)",
                              }}
                            >
                              {dayName}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Monthly Dates Indicator Chips */}
                  {freq === "monthly" && rec.days && rec.days.length > 0 && (
                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          color: "var(--gh-muted)",
                          fontSize: "11px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          marginBottom: "6px",
                        }}
                      >
                        Active Dates of Month
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {[...rec.days]
                          .sort((a, b) => a - b)
                          .map((d) => (
                            <div
                              key={d}
                              style={{
                                padding: "0 8px",
                                height: "26px",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "rgba(88, 166, 255, 0.15)",
                                border: "1px solid var(--gh-blue)",
                                fontSize: "11px",
                                fontWeight: "700",
                                color: "var(--gh-blue)",
                              }}
                            >
                              Day {d}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Deadline & Next Occurrence Grid */}
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      borderTop: "1px solid var(--gh-border)",
                      paddingTop: "10px",
                    }}
                  >
                    {/* Time-of-day deadline */}
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "var(--gh-muted)", fontSize: "11px", marginBottom: "2px" }}>
                        {freq === "daily" ? "Daily Deadline" : "Scheduled Deadline"}
                      </div>
                      <div
                        style={{
                          color: deadlineTimeFormatted ? "var(--gh-text)" : "var(--gh-muted)",
                          fontSize: "13px",
                          fontWeight: "700",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {deadlineTimeFormatted || "End of Day"}
                      </div>
                    </div>

                    {/* Deadline occurrence */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: isOverdue ? "var(--gh-red)" : "var(--gh-muted)",
                          fontSize: "11px",
                          marginBottom: "2px",
                          fontWeight: isOverdue ? "700" : "400",
                        }}
                      >
                        {isOverdue ? "! Overdue Deadline" : "Next Deadline"}
                      </div>
                      <div
                        style={{
                          color: isOverdue ? "var(--gh-red)" : "var(--gh-blue)",
                          fontSize: "13px",
                          fontWeight: "700",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {dueFormatted}
                      </div>
                      {isOverdue && nextCycleFormatted && (
                        <div
                          style={{
                            color: "var(--gh-blue)",
                            fontSize: "11px",
                            marginTop: "4px",
                            fontWeight: "600",
                          }}
                        >
                          Next cycle: {nextCycleFormatted}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Overview Stats Card ── */}
            <div
              style={{
                backgroundColor: "var(--gh-surface)",
                border: "1px solid var(--gh-border)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {/* Project */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                    <div
                      style={{
                        backgroundColor: "rgba(188, 140, 255, 0.12)",
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "8px",
                        color: "var(--gh-purple)",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      PROJECT
                    </span>
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      backgroundColor: `${projectColor(selectedTask.project)}18`,
                      border: `1px solid ${projectColor(selectedTask.project)}40`,
                      color: projectColor(selectedTask.project),
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {selectedTask.project}
                  </div>
                </div>

                {/* Estimate */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                    <div
                      style={{
                        backgroundColor: "rgba(210, 153, 34, 0.12)",
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "8px",
                        color: "var(--gh-amber)",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="6" />
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      ESTIMATE
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "var(--gh-text)",
                    }}
                  >
                    {formatEstimateDisplay(selectedTask.est) || "—"}
                  </div>
                </div>

                {/* Subtasks */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                    <div
                      style={{
                        backgroundColor: "rgba(86, 212, 221, 0.12)",
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "8px",
                        color: "#56d4dd",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      SUBTASKS
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: "var(--gh-text)",
                    }}
                  >
                    {doneSubs}
                    <span style={{ color: "var(--gh-muted)", fontWeight: "400" }}> / {totalSubs}</span>
                  </div>
                </div>

                {/* Time Spent */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                    <div
                      style={{
                        backgroundColor: "rgba(88, 166, 255, 0.12)",
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "8px",
                        color: "var(--gh-blue)",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      TIME SPENT
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: totalSpent > 0 ? "var(--gh-green)" : "var(--gh-muted)",
                    }}
                  >
                    {fmtSeconds(totalSpent)}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Attributes Card ── */}
            <div
              style={{
                backgroundColor: "var(--gh-surface)",
                border: "1px solid var(--gh-border)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                <div
                  style={{
                    backgroundColor: "rgba(139, 148, 158, 0.12)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "8px",
                    color: "var(--gh-muted)",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  ATTRIBUTES
                </span>
              </div>
              <div>
                {attributeRows.map((row, idx) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "9px 0",
                      borderBottom: idx === attributeRows.length - 1 ? "none" : "1px solid var(--gh-border)",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ marginRight: "10px", fontSize: "13px", width: "20px", textAlign: "center" }}>
                      {row.icon}
                    </span>
                    <span style={{ color: "var(--gh-muted)", flex: 1 }}>{row.label}</span>
                    <span
                      style={{
                        color: row.color || "var(--gh-text)",
                        fontWeight: row.weight || "600",
                        fontFamily: "var(--mono)",
                        fontSize: "12px",
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── NOTES Card ── */}
            <div
              style={{
                backgroundColor: "var(--gh-surface)",
                border: "1px solid var(--gh-border)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      backgroundColor: "rgba(139, 148, 158, 0.12)",
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "8px",
                      color: "var(--gh-muted)",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    NOTES
                  </span>
                </div>
                {!isEditingNotes && (
                  <button
                    onClick={() => {
                      setEditedNotesText(selectedTask.notes || "");
                      setIsEditingNotes(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "var(--gh-muted)",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Edit Notes"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
              </div>

              {!isEditingNotes ? (
                <div>
                  {selectedTask.notes && selectedTask.notes.trim() ? (
                    <div
                      style={{
                        color: "var(--gh-text)",
                        fontSize: "13px",
                        lineHeight: "1.6",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {selectedTask.notes}
                    </div>
                  ) : (
                    <div style={{ color: "var(--gh-muted)", fontSize: "13px", fontStyle: "italic" }}>
                      No notes added yet. Click the edit icon to add notes...
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      backgroundColor: "var(--gh-bg)",
                      border: "1px solid var(--gh-blue)",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "var(--gh-text)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      minHeight: "100px",
                      resize: "vertical",
                      marginBottom: "10px",
                      outline: "none",
                    }}
                    value={editedNotesText}
                    onChange={(e) => setEditedNotesText(e.target.value)}
                    placeholder="Add notes, descriptions, or links for this task..."
                    autoFocus
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button
                      className="btn"
                      onClick={() => setIsEditingNotes(false)}
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveNotes}
                      style={{ padding: "5px 14px", fontSize: "12px", fontWeight: "600" }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CHECKLIST TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "checklist" && (
          <>
            {/* Checklist Header Card */}
            <div
              style={{
                backgroundColor: "var(--gh-surface)",
                border: "1px solid var(--gh-border)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    backgroundColor: "rgba(86, 212, 221, 0.12)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "8px",
                    color: "#56d4dd",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  CHECKLIST ({doneSubs}/{totalSubs})
                </span>
              </div>
              {totalSubs > 0 && (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: progressInfo.color,
                    fontWeight: "600",
                    backgroundColor: `${progressInfo.color}18`,
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {progressInfo.pct}%
                </span>
              )}
            </div>

            {totalSubs > 0 && (
              <div className="subtask-progress-bar" style={{ marginBottom: "14px" }}>
                <div
                  className="subtask-progress-fill"
                  style={{
                    width: progressInfo.pct + "%",
                    background: progressInfo.color,
                  }}
                />
              </div>
            )}

            {/* Subtasks List */}
            {totalSubs > 0 ? (
              <div className="subtask-list" style={{ marginBottom: "16px" }}>
                {subtasks.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      backgroundColor: "var(--gh-surface2)",
                      border: "1px solid var(--gh-border)",
                      borderRadius: "8px",
                      marginBottom: "6px",
                      fontSize: "13px",
                      opacity: s.done ? 0.65 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      onClick={() => onToggleSubtask(selectedTask.id, s.id)}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: `1.5px solid ${s.done ? "var(--gh-green)" : "var(--gh-border2)"}`,
                        backgroundColor: s.done ? "var(--gh-green)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                        color: "#fff",
                        fontSize: "10px",
                      }}
                    >
                      {s.done && "✓"}
                    </div>
                    <span
                      onClick={() => onToggleSubtask(selectedTask.id, s.id)}
                      style={{
                        textDecoration: s.done ? "line-through" : "none",
                        color: s.done ? "var(--gh-muted)" : "var(--gh-text)",
                        flex: 1,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      {s.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubtask(s.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--gh-muted)",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.6,
                        transition: "opacity 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
                      title="Delete subtask"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  color: "var(--gh-muted)",
                  backgroundColor: "var(--gh-surface2)",
                  border: "1px dashed var(--gh-border)",
                  borderRadius: "10px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>📝</div>
                <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--gh-text)", marginBottom: "4px" }}>
                  No subtasks added yet
                </div>
                <div style={{ fontSize: "11px" }}>Add subtasks below to break this task down.</div>
              </div>
            )}

            <div style={{ display: "flex", gap: "6px" }}>
              <input
                className="add-task-input"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                placeholder="Add subtask..."
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={handleAddSubtask}
                style={{ padding: "6px 14px", fontSize: "13px", fontWeight: "600" }}
              >
                +
              </button>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TIME TRACKING TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "timetracking" && (
          <>
            {/* Header / Add Time Action */}
            <div
              style={{
                backgroundColor: "var(--gh-surface)",
                border: "1px solid var(--gh-border)",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    backgroundColor: "rgba(88, 166, 255, 0.12)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "8px",
                    color: "var(--gh-blue)",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  LOGGED SESSIONS
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setIsLoggingTime((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {isLoggingTime ? "Cancel" : "Add Time"}
              </button>
            </div>

            {/* Manual Time Logging Form */}
            {isLoggingTime && (
              <div
                style={{
                  backgroundColor: "var(--gh-surface2)",
                  border: "1px solid var(--gh-blue)",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--gh-text)", marginBottom: "10px" }}>
                  Log Time Manually
                </div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "10px", color: "var(--gh-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="add-task-input"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      placeholder="0"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "10px", color: "var(--gh-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      Minutes
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      className="add-task-input"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      placeholder="30"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "10px", color: "var(--gh-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    className="add-task-input"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="What did you work on?"
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    className="btn"
                    onClick={() => setIsLoggingTime(false)}
                    style={{ padding: "4px 10px", fontSize: "11px" }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleManualLogTime}
                    style={{ padding: "4px 14px", fontSize: "11px", fontWeight: "600" }}
                  >
                    Log Time
                  </button>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <div
                style={{
                  flex: 1,
                  background: "var(--gh-surface2)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--gh-border)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  Total Time
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--gh-green)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {fmtSeconds(totalSpent)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "var(--gh-surface2)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--gh-border)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  Sessions
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--gh-blue)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {(selectedTask.sessions || []).length}
                </div>
              </div>
            </div>

            {/* Slide to Start / Running Timer */}
            <DetailSection label={isTimerRunning ? "Session Active" : "Start Session"}>
              {!isTimerRunning ? (
                <SlideToStart onSlideComplete={onStartTimer} />
              ) : (
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(63,185,80,0.08), rgba(63,185,80,0.02))",
                    border: "1px solid rgba(63,185,80,0.2)",
                    borderRadius: "12px",
                    padding: "16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <span className="timer-pulse-dot" />
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "28px",
                        fontWeight: "600",
                        color: "var(--gh-green)",
                      }}
                    >
                      {fmtTimer(timerSeconds)}
                    </span>
                  </div>
                  {timerNote && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--gh-muted)",
                        fontStyle: "italic",
                        marginBottom: "10px",
                        padding: "6px 10px",
                        background: "var(--gh-surface2)",
                        borderRadius: "6px",
                        borderLeft: "2px solid var(--gh-green-dim)",
                      }}
                    >
                      "{timerNote}"
                    </div>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={onStopTimer}
                    style={{
                      margin: "0 auto",
                      background: "rgba(248,81,73,0.08)",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop Session
                  </button>
                </div>
              )}
            </DetailSection>

            {/* Session History */}
            <DetailSection label="Session History">
              <div
                className="session-list"
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {(selectedTask.sessions || [])
                  .slice()
                  .reverse()
                  .map((sess) => {
                    const isExpanded = expandedSessions.has(sess.id);
                    const hasDetails =
                      sess.note ||
                      (sess.subtasksCompleted && sess.subtasksCompleted.length > 0);

                    return (
                      <div
                        key={sess.id}
                        className={`session-card ${hasDetails ? "expandable" : ""}`}
                        style={{
                          background: "var(--gh-surface2)",
                          border: "1px solid var(--gh-border)",
                          borderRadius: "8px",
                          overflow: "hidden",
                        }}
                      >
                        {/* Session row header */}
                        <div
                          style={{
                            padding: "10px 12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: hasDetails ? "pointer" : "default",
                          }}
                          onClick={() => hasDetails && toggleSessionExpanded(sess.id)}
                        >
                          {/* Expand arrow */}
                          {hasDetails ? (
                            <svg
                              className={`session-expand-icon ${isExpanded ? "expanded" : ""}`}
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          ) : (
                            <div style={{ width: "12px" }} />
                          )}

                          {/* Duration badge */}
                          <div
                            style={{
                              minWidth: "60px",
                              fontFamily: "var(--mono)",
                              fontSize: "11px",
                              color: "var(--gh-green)",
                              fontWeight: "600",
                              background: "rgba(63,185,80,0.1)",
                              padding: "5px 4px",
                              borderRadius: "6px",
                              textAlign: "center",
                            }}
                          >
                            {fmtSeconds((sess.end - sess.start) / 1000)}
                          </div>

                          {/* Time range & date */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--gh-text)",
                                fontFamily: "var(--mono)",
                              }}
                            >
                              {new Date(sess.start).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              —{" "}
                              {new Date(sess.end).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "var(--gh-muted)",
                                marginTop: "1px",
                              }}
                            >
                              {fmtRelativeTime(sess.start)} ·{" "}
                              {fmtFullDate(sess.start)}
                            </div>
                          </div>
                        </div>

                        {/* Expandable details */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "8px 12px 12px 34px",
                              borderTop: "1px solid var(--gh-border)",
                              background: "rgba(0,0,0,0.1)",
                            }}
                          >
                            {sess.note && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--gh-text)",
                                  marginBottom: "8px",
                                  padding: "8px 10px",
                                  background: "var(--gh-bg)",
                                  borderRadius: "6px",
                                  borderLeft: "2px solid var(--gh-green-dim)",
                                  lineHeight: "1.5",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--gh-muted)",
                                    textTransform: "uppercase",
                                    marginBottom: "4px",
                                    fontFamily: "var(--mono)",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  Session Note
                                </div>
                                {sess.note}
                              </div>
                            )}
                            {sess.subtasksCompleted &&
                              sess.subtasksCompleted.length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "var(--gh-muted)",
                                      textTransform: "uppercase",
                                      marginBottom: "6px",
                                      fontFamily: "var(--mono)",
                                      letterSpacing: "0.3px",
                                    }}
                                  >
                                    Subtasks Completed
                                  </div>
                                  {sess.subtasksCompleted.map((st, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        fontSize: "12px",
                                        color: "var(--gh-green)",
                                        marginBottom: "4px",
                                        padding: "3px 0",
                                      }}
                                    >
                                      <span style={{ fontSize: "10px" }}>☑️</span>
                                      <span>{st.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {(selectedTask.sessions || []).length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "var(--gh-muted)",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ fontSize: "20px", marginBottom: "8px", opacity: 0.6 }}>
                      ⏱
                    </div>
                    No sessions recorded yet
                    <div style={{ fontSize: "11px", marginTop: "4px" }}>
                      Slide to start your first session
                    </div>
                  </div>
                )}
              </div>
            </DetailSection>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            HISTORY TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "history" && (
          <>
            {/* ── Streak Dashboard (only for recurring tasks with streaks enabled) ── */}
            {selectedTask.recurrence?.streakEnabled && (() => {
              const rec = selectedTask.recurrence;
              const history = rec.history || [];
              const freqLabel =
                formatRecurrenceSchedule(rec.frequency, rec.days) ||
                (rec.frequency === "daily"
                  ? "Daily"
                  : rec.frequency === "weekly"
                  ? "Weekly"
                  : "Monthly");
              const dotHistory = history.slice(-28);
              const fmtPeriodDate = (iso) => {
                if (!iso) return "—";
                const [, m, d] = iso.split("-").map(Number);
                const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                return `${months[m - 1]} ${d}`;
              };

              return (
                <div style={{ marginBottom: "20px" }}>
                  {/* Header: Streak type badge */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
                    <div
                      style={{
                        backgroundColor: "rgba(240, 136, 62, 0.12)",
                        borderRadius: "8px",
                        padding: "4px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "14px", color: "#f0883e", fontWeight: "800" }}>★</span>
                      <span style={{ color: "#f0883e", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px" }}>
                        {freqLabel} Streak
                      </span>
                    </div>
                  </div>

                  {/* Current + Max Streak Cards */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                    {/* Current Streak */}
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: rec.currentStreak > 0 ? "rgba(240, 136, 62, 0.08)" : "var(--gh-surface)",
                        border: `1px solid ${rec.currentStreak > 0 ? "rgba(240, 136, 62, 0.3)" : "var(--gh-border)"}`,
                        borderRadius: "12px",
                        padding: "14px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "28px", fontWeight: "800", color: rec.currentStreak > 0 ? "#f0883e" : "var(--gh-muted)" }}>
                        {rec.currentStreak || 0}
                      </div>
                      <div style={{ fontSize: "10px", fontWeight: "600", color: "var(--gh-muted)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Current Streak
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--gh-muted)", marginTop: "2px" }}>
                        {rec.currentStreak === 1 ? "1 in a row" : `${rec.currentStreak || 0} in a row`}
                      </div>
                    </div>

                    {/* Max Streak */}
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: rec.maxStreak > 0 ? "rgba(88, 166, 255, 0.08)" : "var(--gh-surface)",
                        border: `1px solid ${rec.maxStreak > 0 ? "rgba(88, 166, 255, 0.25)" : "var(--gh-border)"}`,
                        borderRadius: "12px",
                        padding: "14px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "28px", fontWeight: "800", color: rec.maxStreak > 0 ? "var(--gh-blue)" : "var(--gh-muted)" }}>
                        {rec.maxStreak || 0}
                      </div>
                      <div style={{ fontSize: "10px", fontWeight: "600", color: "var(--gh-muted)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Best Streak
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--gh-muted)", marginTop: "2px" }}>
                        All-time record
                      </div>
                    </div>
                  </div>

                  {/* Dot Grid — last 28 occurrences */}
                  {dotHistory.length > 0 && (
                    <div
                      style={{
                        backgroundColor: "var(--gh-surface)",
                        border: "1px solid var(--gh-border)",
                        borderRadius: "12px",
                        padding: "14px",
                        marginBottom: "14px",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                        HISTORY GRID
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {dotHistory.map((entry) => {
                          const dotColor = entry.completed ? "#3fb950" : entry.missed ? "#f85149" : "var(--gh-border2)";
                          const dotBg = entry.completed ? "rgba(63,185,80,0.15)" : entry.missed ? "rgba(248,81,73,0.15)" : "transparent";
                          return (
                            <div
                              key={entry.id}
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "6px",
                                backgroundColor: dotBg,
                                border: `1.5px solid ${dotColor}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                fontWeight: "700",
                                color: dotColor,
                              }}
                              title={`Period: ${entry.periodDue} (${entry.completed ? "Completed" : "Missed"})`}
                            >
                              {entry.completed ? "✓" : entry.missed ? "✗" : ""}
                            </div>
                          );
                        })}
                      </div>
                      {/* Legend */}
                      <div style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: "#3fb950" }} />
                          <span style={{ fontSize: "11px", color: "var(--gh-muted)" }}>Completed</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: "#f85149" }} />
                          <span style={{ fontSize: "11px", color: "var(--gh-muted)" }}>Missed</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Completion History List */}
                  {history.length > 0 ? (
                    <div style={{ marginBottom: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                        RECURRENCE LOG
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {[...history].reverse().map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              backgroundColor: "var(--gh-surface)",
                              border: `1px solid ${entry.completed ? "rgba(63,185,80,0.2)" : "rgba(248,81,73,0.2)"}`,
                              borderRadius: "10px",
                              padding: "10px 12px",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "8px",
                                backgroundColor: entry.completed ? "rgba(63,185,80,0.12)" : "rgba(248,81,73,0.12)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "13px",
                              }}
                            >
                              {entry.completed ? "✅" : "❌"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: "var(--gh-text)", fontSize: "12px", fontWeight: "600" }}>
                                Due: {fmtPeriodDate(entry.periodDue)}
                              </div>
                              <div style={{ color: "var(--gh-muted)", fontSize: "11px", marginTop: "1px" }}>
                                {entry.completed
                                  ? `Completed ${entry.completedAt ? fmtRelativeTime(entry.completedAt) : ""}`
                                  : "Missed — deadline passed"}
                              </div>
                            </div>
                            <div
                              style={{
                                backgroundColor: entry.completed ? "rgba(63,185,80,0.12)" : "rgba(248,81,73,0.12)",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "10px",
                                fontWeight: "700",
                                color: entry.completed ? "#3fb950" : "#f85149",
                              }}
                            >
                              {entry.completed ? "DONE" : "MISSED"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: "var(--gh-surface)",
                        border: "1px solid var(--gh-border)",
                        borderRadius: "12px",
                        padding: "16px",
                        textAlign: "center",
                        marginBottom: "14px",
                      }}
                    >
                      <div style={{ fontSize: "20px", marginBottom: "6px" }}>🎯</div>
                      <div style={{ color: "var(--gh-text)", fontSize: "13px", fontWeight: "600", marginBottom: "2px" }}>
                        No completions yet
                      </div>
                      <div style={{ color: "var(--gh-muted)", fontSize: "11px" }}>
                        Complete this task before the due date to start your streak!
                      </div>
                    </div>
                  )}

                  <div style={{ height: "1px", backgroundColor: "var(--gh-border)", margin: "16px 0" }} />
                </div>
              );
            })()}

            <div
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--gh-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "12px",
              }}
            >
              AUDIT LOG TIMELINE
            </div>

            {(selectedTask.auditLog || []).length > 0 ? (
              <div className="audit-log">
                {[...(selectedTask.auditLog || [])]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((entry) => {
                    const meta = AUDIT_ICONS[entry.action] || {
                      icon: "📝",
                      label: entry.action,
                      color: "var(--gh-muted)",
                    };
                    return (
                      <div key={entry.id} className="audit-entry">
                        <div
                          className="audit-dot"
                          style={{
                            background: meta.color + "20",
                            color: meta.color,
                          }}
                        >
                          {meta.icon}
                        </div>
                        <div className="audit-content">
                          <div className="audit-action">
                            {meta.label}
                            {entry.details?.subtaskTitle && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--gh-text)",
                                  fontWeight: "400",
                                  marginLeft: "6px",
                                }}
                              >
                                — {entry.details.subtaskTitle}
                              </span>
                            )}
                            {entry.details?.from && entry.details?.to && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--gh-muted)",
                                  fontWeight: "400",
                                  marginLeft: "6px",
                                }}
                              >
                                {entry.details.from} → {entry.details.to}
                              </span>
                            )}
                            {entry.action === "timer_stopped" &&
                              entry.details?.duration != null && (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--gh-green)",
                                    fontWeight: "600",
                                    marginLeft: "6px",
                                    fontFamily: "var(--mono)",
                                  }}
                                >
                                  {fmtSeconds(entry.details.duration)}
                                </span>
                              )}
                          </div>
                          <div className="audit-time">
                            {fmtRelativeTime(entry.timestamp)} ·{" "}
                            {fmtFullDate(entry.timestamp)}
                          </div>
                          {entry.details?.note && (
                            <div className="audit-reason">
                              "{entry.details.note}"
                            </div>
                          )}
                          {entry.details?.reason && (
                            <div className="audit-reason">
                              "{entry.details.reason}"
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="history-empty-state">
                <div className="history-empty-icon">📜</div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "4px",
                    color: "var(--gh-text)",
                  }}
                >
                  No activity yet
                </div>
                <div style={{ fontSize: "12px" }}>
                  Events will appear here as you work on this task
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Bottom Timer Widget (fixed at bottom when timer is running) ─── */}
      {isTimerRunning && (
        <div
          className="timer-widget"
          style={{
            padding: "14px 16px",
            borderTop: "1px solid var(--gh-border)",
            background:
              "linear-gradient(180deg, var(--gh-surface2), var(--gh-surface))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              marginBottom: "6px",
            }}
          >
            <span className="timer-pulse-dot" />
            <div
              className="timer-display"
              style={{
                fontFamily: "var(--mono)",
                fontSize: "28px",
                fontWeight: "600",
                color: "var(--gh-green)",
              }}
            >
              {fmtTimer(timerSeconds)}
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: "10px",
              color: "var(--gh-muted)",
              fontFamily: "var(--mono)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {timerNote && (
              <span style={{ fontStyle: "italic", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                "{timerNote}"
              </span>
            )}
            {timerNote && <span style={{ color: "var(--gh-border2)" }}>·</span>}
            <span
              onClick={onStopTimer}
              style={{
                color: "var(--gh-red)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Stop
            </span>
          </div>
        </div>
      )}

      {/* Task Options Modal */}
      <TaskOptionsModal
        isOpen={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        isMuted={!!selectedTask?.muted}
        onUpdate={() => {
          setOptionsModalVisible(false);
          if (onOpenEditModal) onOpenEditModal();
        }}
        onDelete={() => {
          setOptionsModalVisible(false);
          if (onDeleteTask) onDeleteTask(selectedTask.id);
        }}
        onToggleMute={() => {
          setOptionsModalVisible(false);
          if (onToggleMute) {
            onToggleMute(selectedTask.id);
          } else {
            setTasks(tasks.map((t) => (t.id === selectedTask.id ? { ...t, muted: !t.muted } : t)));
          }
        }}
      />
    </div>
  );
}
