import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDateDisplay = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return months[parseInt(m) - 1] + " " + parseInt(d) + ", " + y;
};

const fmtSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
};

const getDeadlineInfo = (dueDate) => {
  if (!dueDate) return { color: "var(--gh-text)", label: "", dotColor: "transparent" };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { color: "#f85149", label: Math.abs(diffDays) + "d overdue", dotColor: "#f85149" };
  if (diffDays === 0) return { color: "#e3b341", label: "Due today!", dotColor: "#e3b341" };
  if (diffDays === 1) return { color: "#f0883e", label: "Due tomorrow", dotColor: "#f0883e" };
  if (diffDays <= 2) return { color: "#f0883e", label: diffDays + "d left", dotColor: "#f0883e" };
  if (diffDays <= 7) return { color: "#d29922", label: diffDays + "d left", dotColor: "#d29922" };
  return { color: "#3fb950", label: diffDays + "d left", dotColor: "#3fb950" };
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

function DetailRow({ label, value, color }) {
  return (
    <div
      className="detail-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 0",
        borderBottom: "1px solid var(--gh-border)",
        fontSize: "13px",
      }}
    >
      <span style={{ color: "var(--gh-muted)", width: "100px" }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: "12px",
          color: color || "var(--gh-text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Slide to Start Component ───────────────────────────────────────────────

function SlideToStart({ onSlideComplete }) {
  const [position, setPosition] = useState(0);
  const isDraggingRef = useRef(false);
  const trackRef = useRef(null);
  const onCompleteRef = useRef(onSlideComplete);
  onCompleteRef.current = onSlideComplete;

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
          setTimeout(() => onCompleteRef.current(), 50);
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

  const trackWidth = trackRef.current?.offsetWidth || 300;
  const maxTravel = trackWidth - thumbSize - pad * 2;
  const thumbLeft = pad + position * maxTravel;

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
          width: `${thumbLeft + thumbSize}px`,
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
          left: `${thumbLeft}px`,
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
  onToggleSubtask,
  onAddSubtask,
  activeSessionStart,
  timerNote,
}) {
  const projectColor = (p) => {
    const found = projects.find((proj) => proj.name === p);
    return found ? found.color : "#8b949e";
  };

  const [activeTab, setActiveTab] = useState("details");
  const [newSubtask, setNewSubtask] = useState("");
  const [expandedSessions, setExpandedSessions] = useState(new Set());

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
          <button
            className="btn"
            onClick={onOpenEditModal}
            style={{ flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
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
            <DetailSection label="Task Details">
              <DetailRow
                label="Project"
                value={selectedTask.project}
                color={projectColor(selectedTask.project)}
              />
              {(() => {
                const dlInfo = getDeadlineInfo(selectedTask.due);
                return (
                  <div
                    className="detail-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "6px 0",
                      borderBottom: "1px solid var(--gh-border)",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "var(--gh-muted)", width: "100px" }}>Due Date</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
                      <span
                        className="deadline-indicator"
                        style={{ background: dlInfo.dotColor }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "12px",
                          color: dlInfo.color,
                          fontWeight: dlInfo.label ? "600" : "400",
                        }}
                      >
                        {fmtDateDisplay(selectedTask.due)}
                      </span>
                      {dlInfo.label && (
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: "10px",
                            color: dlInfo.color,
                            background: dlInfo.color + "18",
                            border: `1px solid ${dlInfo.color}40`,
                            borderRadius: "12px",
                            padding: "1px 8px",
                            marginLeft: "4px",
                            fontWeight: "600",
                          }}
                        >
                          {dlInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
              <DetailRow label="Estimated" value={selectedTask.est} />
              <DetailRow
                label="Created"
                value={selectedTask.createdAt ? fmtFullDate(selectedTask.createdAt) : "—"}
              />
              {selectedTask.done && selectedTask.completedAt && (
                <DetailRow
                  label="Completed"
                  value={"✓ " + fmtFullDate(selectedTask.completedAt)}
                  color="#3fb950"
                />
              )}
            </DetailSection>

            {/* ── Progress & Metrics ── */}
            <DetailSection label="Progress & Metrics">
              {/* Subtask Breakdown Progress Row */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--gh-muted)", fontWeight: "500" }}>Checklist Progress</span>
                  {totalSubs > 0 ? (
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "11px",
                        color: progressInfo.color,
                        fontWeight: "600",
                      }}
                    >
                      {progressInfo.pct}% · {doneSubs}/{totalSubs}
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "var(--gh-muted)", fontStyle: "italic" }}>
                      No subtasks
                    </span>
                  )}
                </div>
                {totalSubs > 0 ? (
                  <div className="subtask-progress-bar" style={{ margin: 0 }}>
                    <div
                      className="subtask-progress-fill"
                      style={{
                        width: progressInfo.pct + "%",
                        background: progressInfo.color,
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "var(--gh-muted)", fontStyle: "italic" }}>
                    Create subtasks in the Checklist tab
                  </div>
                )}
              </div>

              {/* Time Spent & Sessions overview cards */}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <div style={{
                  flex: 1,
                  background: "var(--gh-surface2)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--gh-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}>
                  <span style={{ fontSize: "9px", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.3px" }}>Total Time Logged</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: totalSpent > 0 ? "var(--gh-green)" : "var(--gh-muted)" }}>
                    {fmtSeconds(totalSpent)}
                  </span>
                </div>
                <div style={{
                  flex: 1,
                  background: "var(--gh-surface2)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--gh-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}>
                  <span style={{ fontSize: "9px", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.3px" }}>Sessions</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--gh-text)" }}>
                    {(selectedTask.sessions || []).length}
                  </span>
                </div>
              </div>
            </DetailSection>

            {/* ── Notes ── */}
            <DetailSection label="Notes">
              <div
                className="notes-display"
                style={{
                  width: "100%",
                  background: "var(--gh-surface2)",
                  border: "1px solid var(--gh-border)",
                  borderRadius: "6px",
                  padding: "10px",
                  color: "var(--gh-text)",
                  fontFamily: "var(--mono)",
                  fontSize: "13px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: "1.5",
                  minHeight: "36px",
                }}
              >
                {selectedTask.notes || (
                  <span style={{ color: "var(--gh-muted)", fontStyle: "italic" }}>
                    No notes added
                  </span>
                )}
              </div>
            </DetailSection>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CHECKLIST TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "checklist" && (
          <>
            <DetailSection
              label="Task Checklist"
              action={
                totalSubs > 0 ? (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: progressInfo.color,
                      fontWeight: "600",
                    }}
                  >
                    {progressInfo.pct}% · {doneSubs}/{totalSubs}
                  </span>
                ) : null
              }
            >
              {totalSubs > 0 && (
                <div className="subtask-progress-bar">
                  <div
                    className="subtask-progress-fill"
                    style={{
                      width: progressInfo.pct + "%",
                      background: progressInfo.color,
                    }}
                  />
                </div>
              )}
              
              {totalSubs > 0 ? (
                <div className="subtask-list" style={{ marginBottom: "12px" }}>
                  {subtasks.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        background: "var(--gh-surface2)",
                        border: "1px solid var(--gh-border)",
                        borderRadius: "8px",
                        marginBottom: "6px",
                        fontSize: "14px",
                        opacity: s.done ? 0.6 : 1,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        onClick={() => onToggleSubtask(selectedTask.id, s.id)}
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          border: "1.5px solid",
                          borderColor: s.done
                            ? "var(--gh-green-dim)"
                            : "var(--gh-border2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: s.done ? "var(--gh-green-dim)" : "transparent",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {s.done && (
                          <span style={{ color: "#fff", fontSize: "10px" }}>✓</span>
                        )}
                      </div>
                      <span
                        style={{
                          textDecoration: s.done ? "line-through" : "none",
                          color: s.done ? "var(--gh-muted)" : "var(--gh-text)",
                          flex: 1,
                        }}
                      >
                        {s.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    color: "var(--gh-muted)",
                    background: "var(--gh-surface2)",
                    border: "1px dashed var(--gh-border)",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>📝</div>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--gh-text)", marginBottom: "4px" }}>No subtasks yet</div>
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
                  style={{ padding: "2px 10px" }}
                >
                  +
                </button>
              </div>
            </DetailSection>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TIME TRACKING TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "timetracking" && (
          <>
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
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                              flex: 1,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: "12px",
                                fontWeight: "500",
                                color: "var(--gh-text)",
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
                            </span>
                            <span
                              style={{ fontSize: "11px", color: "var(--gh-muted)" }}
                            >
                              {new Date(sess.start).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Note indicator */}
                          {hasDetails && !isExpanded && (
                            <div
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "var(--gh-blue)",
                                flexShrink: 0,
                                opacity: 0.7,
                              }}
                            />
                          )}
                        </div>

                        {/* Expanded content */}
                        {isExpanded && hasDetails && (
                          <div
                            className="session-expanded-content"
                            style={{
                              padding: "0 12px 12px",
                              borderTop: "1px solid var(--gh-border)",
                              paddingTop: "10px",
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
    </div>
  );
}
