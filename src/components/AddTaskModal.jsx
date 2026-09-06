import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getValidOffsets,
  getRecurringReminderOffsets,
  getValidRepeats,
  generateSchedulePreview,
  countTotalReminders,
  formatEstimateDisplay,
  getInitialRecurringDueDate,
  OVERDUE_REPEAT_OPTIONS,
} from "../utils/reminderUtils";

const INBOX_PROJECT = { name: "Inbox", color: "#58a6ff" };
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function AddTaskDialog({
  onClose,
  onAdd,
  projects = [],
  initialTask = null,
  defaultProject = null,
}) {
  const [nowMs] = useState(() => Date.now());

  // Form state initialized directly from props
  const [title, setTitle] = useState(() => initialTask?.title || "");
  const [project, setProject] = useState(
    () => initialTask?.project || initialTask?.target || defaultProject || "Inbox"
  );
  const [target] = useState(() => initialTask?.target || "today");
  const [priority, setPriority] = useState(() => initialTask?.priority || "Low");
  const [est, setEst] = useState(() => initialTask?.est || "");
  const [isCustomEst, setIsCustomEst] = useState(() => {
    const standardEsts = ["15m", "30m", "1h", "2h", "4h"];
    return Boolean(initialTask?.est && !standardEsts.includes(initialTask.est));
  });
  const [customEstVal, setCustomEstVal] = useState(() => {
    const standardEsts = ["15m", "30m", "1h", "2h", "4h"];
    return initialTask?.est && !standardEsts.includes(initialTask.est)
      ? initialTask.est
      : "";
  });
  const [due, setDue] = useState(() => initialTask?.due || "");
  const [dueTime, setDueTime] = useState(() => initialTask?.dueTime || "");
  const [notes, setNotes] = useState(() => initialTask?.notes || "");

  // Reminder state
  const [remindBefore, setRemindBefore] = useState(
    () => initialTask?.reminder?.remindBefore ?? null
  );
  const [repeatEvery, setRepeatEvery] = useState(
    () => initialTask?.reminder?.repeatEvery ?? null
  );
  const [notifyOverdue, setNotifyOverdue] = useState(
    () => initialTask?.reminder?.notifyOverdue ?? false
  );
  const [overdueRepeatEvery, setOverdueRepeatEvery] = useState(
    () => initialTask?.reminder?.overdueRepeatEvery ?? null
  );

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(() => Boolean(initialTask?.recurrence));
  const [recurrenceFrequency, setRecurrenceFrequency] = useState(
    () => initialTask?.recurrence?.frequency || "daily"
  );
  const [recurrenceDays, setRecurrenceDays] = useState(
    () => initialTask?.recurrence?.days || []
  );

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Derived projects list
  const allProjects = useMemo(() => {
    const WORKSPACE_VIEWS = new Set([
      "all", "today", "archive", "backlog", "scheduled", "stats", "timetracking", "tracking",
    ]);
    const validProjects = (projects || []).filter(
      (p) => p && p.name && !WORKSPACE_VIEWS.has(p.name.trim().toLowerCase())
    );
    const hasInbox = validProjects.some((p) => p.name.trim().toLowerCase() === "inbox");
    return hasInbox ? validProjects : [INBOX_PROJECT, ...validProjects];
  }, [projects]);

  // Due datetime timestamp in ms
  const dueDateTimeMs = useMemo(() => {
    if (!due) return null;
    const [y, m, d] = due.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dueTime) {
      const [h, min] = dueTime.split(":").map(Number);
      dateObj.setHours(h, min, 0, 0);
    } else {
      dateObj.setHours(23, 59, 59, 999);
    }
    return dateObj.getTime();
  }, [due, dueTime]);

  const isPastDue = useMemo(() => {
    if (!isRecurring && due && dueTime && dueDateTimeMs) {
      return dueDateTimeMs <= nowMs;
    }
    return false;
  }, [isRecurring, due, dueTime, dueDateTimeMs, nowMs]);

  // Reminder offsets & repeats
  const availableOffsets = useMemo(() => {
    if (!dueDateTimeMs) return [];
    return getValidOffsets(dueDateTimeMs, nowMs);
  }, [dueDateTimeMs, nowMs]);

  const availableRecurringOffsets = useMemo(() => {
    if (!dueTime) return [];
    return getRecurringReminderOffsets(dueTime);
  }, [dueTime]);

  const availableRepeatOptions = useMemo(() => {
    if (remindBefore === null) return [];
    return getValidRepeats(remindBefore);
  }, [remindBefore]);

  const schedulePreview = useMemo(() => {
    if (!dueDateTimeMs || remindBefore === null) return [];
    return generateSchedulePreview(dueDateTimeMs, remindBefore, repeatEvery || 0);
  }, [dueDateTimeMs, remindBefore, repeatEvery]);

  const totalReminders = useMemo(() => {
    if (!dueDateTimeMs || remindBefore === null) return 0;
    return countTotalReminders(dueDateTimeMs, remindBefore, repeatEvery || 0);
  }, [dueDateTimeMs, remindBefore, repeatEvery]);

  const availableOverdueRepeatOptions = useMemo(() => {
    if (!isRecurring || !dueTime) return OVERDUE_REPEAT_OPTIONS;
    const [h, m] = dueTime.split(":").map(Number);
    const minutesToMidnight = 24 * 60 - (h * 60 + m);
    const windowMs = minutesToMidnight * 60 * 1000;
    const filtered = OVERDUE_REPEAT_OPTIONS.filter((o) => o.value < windowMs);
    return filtered.length > 0 ? filtered : [OVERDUE_REPEAT_OPTIONS[0]];
  }, [isRecurring, dueTime]);

  const canSubmit = title.trim().length > 0 && !isPastDue;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    let reminder;
    if ((due || isRecurring) && (remindBefore !== null || notifyOverdue)) {
      reminder = {};
      if (remindBefore !== null) {
        reminder.remindBefore = remindBefore;
        if (repeatEvery !== null) {
          reminder.repeatEvery = repeatEvery;
        }
      }
      if (notifyOverdue) {
        reminder.notifyOverdue = true;
        if (overdueRepeatEvery !== null) {
          reminder.overdueRepeatEvery = overdueRepeatEvery;
        }
      }
    }

    const recurrenceConfig = isRecurring
      ? {
          frequency: recurrenceFrequency,
          streakEnabled: true,
          days: recurrenceDays.length > 0 ? recurrenceDays : undefined,
          currentStreak: initialTask?.recurrence?.currentStreak || 0,
          maxStreak: initialTask?.recurrence?.maxStreak || 0,
          history: initialTask?.recurrence?.history || [],
        }
      : undefined;

    let finalDue;
    if (isRecurring) {
      if (initialTask?.due && initialTask?.recurrence?.frequency === recurrenceFrequency) {
        finalDue = initialTask.due;
      } else {
        finalDue = getInitialRecurringDueDate(
          recurrenceFrequency,
          recurrenceDays.length > 0 ? recurrenceDays : undefined,
          dueTime || undefined
        );
      }
    } else {
      finalDue = due || undefined;
    }

    const effectiveEst = isCustomEst ? customEstVal.trim() : est;

    const taskData = {
      ...(initialTask || {}),
      title: title.trim(),
      project,
      priority,
      est: formatEstimateDisplay(effectiveEst) || effectiveEst || undefined,
      due: finalDue,
      dueTime: dueTime || undefined,
      reminder: reminder
        ? {
            ...reminder,
            lastNotifiedAt: initialTask?.reminder?.lastNotifiedAt || 0,
            dismissed: initialTask?.reminder?.dismissed || false,
          }
        : undefined,
      recurrence: recurrenceConfig,
      notes: notes.trim() || undefined,
      auditLog: [
        ...(initialTask?.auditLog || []),
        {
          timestamp: Date.now(),
          action: initialTask ? "task_updated" : "created",
        },
      ],
      target: isRecurring
        ? "today"
        : due
        ? due === new Date().toISOString().split("T")[0]
          ? "today"
          : due < new Date().toISOString().split("T")[0]
          ? "backlog"
          : "scheduled"
        : (initialTask?.target || target),
    };

    onAdd(taskData);
    onClose();
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        backdropFilter: "blur(2px)",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.94, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 15, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "var(--gh-surface)",
          border: "1px solid var(--gh-border)",
          borderRadius: "14px",
          width: "560px",
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 35px -10px rgba(0, 0, 0, 0.6)",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--gh-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--gh-text)" }}>
            {initialTask ? "Edit Task" : "Add Task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--gh-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gh-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--gh-muted)")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              overflowY: "auto",
            }}
          >
            {/* ── Title ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Title
              </label>
              <input
                autoFocus
                className="add-task-input"
                style={{
                  width: "100%",
                  fontSize: "14px",
                  background: "var(--gh-bg)",
                  borderColor: "var(--gh-border)",
                }}
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* ── Project (Chips) ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Project
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {allProjects.map((p) => {
                  const isSelected = project === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setProject(p.name)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        border: `1px solid ${isSelected ? p.color : "var(--gh-border)"}`,
                        background: isSelected ? `${p.color}18` : "transparent",
                        color: isSelected ? p.color : "var(--gh-muted)",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: p.color,
                        }}
                      />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Priority (Chips) ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Priority
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { label: "High", color: "var(--gh-red)" },
                  { label: "Moderate", color: "var(--gh-amber)" },
                  { label: "Low", color: "var(--gh-green)" },
                ].map((p) => {
                  const isSelected = priority === p.label;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPriority(p.label)}
                      style={{
                        flex: 1,
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        border: `1px solid ${isSelected ? p.color : "var(--gh-border)"}`,
                        background: isSelected ? `${p.color}18` : "transparent",
                        color: isSelected ? p.color : "var(--gh-muted)",
                        textAlign: "center",
                      }}
                    >
                      {p.label === "High" ? "↑ High" : p.label === "Moderate" ? "• Moderate" : "↓ Low"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Estimated Time ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Estimated Time
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {[
                  { label: "15m", val: "15m" },
                  { label: "30m", val: "30m" },
                  { label: "1h", val: "1h" },
                  { label: "2h", val: "2h" },
                  { label: "4h", val: "4h" },
                ].map((item) => {
                  const isSelected = !isCustomEst && est === item.val;
                  return (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => {
                        setIsCustomEst(false);
                        setEst(isSelected ? "" : item.val);
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        border: `1px solid ${isSelected ? "var(--gh-purple)" : "var(--gh-border)"}`,
                        background: isSelected ? "rgba(188, 140, 255, 0.15)" : "transparent",
                        color: isSelected ? "var(--gh-purple)" : "var(--gh-muted)",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsCustomEst(!isCustomEst)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    border: `1px solid ${isCustomEst ? "var(--gh-purple)" : "var(--gh-border)"}`,
                    background: isCustomEst ? "rgba(188, 140, 255, 0.15)" : "transparent",
                    color: isCustomEst ? "var(--gh-purple)" : "var(--gh-muted)",
                  }}
                >
                  Custom...
                </button>
              </div>

              {isCustomEst && (
                <input
                  className="add-task-input"
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    background: "var(--gh-bg)",
                    borderColor: "var(--gh-border)",
                    marginTop: "4px",
                  }}
                  placeholder="e.g. 45m, 1h 30m, 3h"
                  value={customEstVal}
                  onChange={(e) => setCustomEstVal(e.target.value)}
                />
              )}
            </div>

            {/* ── Due Date & Time / Deadline ── */}
            {isRecurring ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {recurrenceFrequency === "daily"
                    ? "Daily Deadline Time"
                    : recurrenceFrequency === "weekly"
                    ? "Deadline Time (each selected day)"
                    : "Deadline Time (each selected date)"}
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="time"
                    className="add-task-input"
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      background: "var(--gh-bg)",
                      borderColor: dueTime ? "var(--gh-blue)" : "var(--gh-border)",
                      colorScheme: "dark",
                    }}
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                  {dueTime && (
                    <button
                      type="button"
                      onClick={() => setDueTime("")}
                      style={{
                        padding: "8px",
                        borderRadius: "6px",
                        background: "var(--gh-surface2)",
                        border: "1px solid var(--gh-border)",
                        color: "var(--gh-muted)",
                        cursor: "pointer",
                      }}
                      title="Clear time"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <span style={{ fontSize: "11px", color: "var(--gh-muted)", fontStyle: "italic" }}>
                  {recurrenceFrequency === "daily"
                    ? "Applies every day — no specific date needed."
                    : recurrenceFrequency === "weekly"
                    ? "Applies on each selected day — no specific date needed."
                    : "Applies on each selected date — no specific date needed."}
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "var(--gh-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Due Date
                    </label>
                    <input
                      type="date"
                      className="add-task-input"
                      style={{
                        width: "100%",
                        fontSize: "13px",
                        background: "var(--gh-bg)",
                        borderColor: due ? "var(--gh-blue)" : "var(--gh-border)",
                        colorScheme: "dark",
                      }}
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "var(--gh-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Due Time
                    </label>
                    <input
                      type="time"
                      className="add-task-input"
                      style={{
                        width: "100%",
                        fontSize: "13px",
                        background: "var(--gh-bg)",
                        borderColor: dueTime ? "var(--gh-blue)" : "var(--gh-border)",
                        colorScheme: "dark",
                      }}
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                    />
                  </div>
                </div>
                {isPastDue && (
                  <span style={{ fontSize: "11px", color: "var(--gh-red)", fontStyle: "italic" }}>
                    * Due time cannot be in the past
                  </span>
                )}
              </div>
            )}

            {/* ── Reminders ── */}
            <div style={{ display: "flex", gap: "12px" }}>
              {/* Start Reminding */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "var(--gh-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Start Reminding
                  </label>
                </div>
                <select
                  className="add-task-input"
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    background: "var(--gh-bg)",
                    borderColor: "var(--gh-border)",
                    opacity: (!due && !isRecurring) || (isRecurring && !dueTime) ? 0.5 : 1,
                  }}
                  value={remindBefore === null ? "" : remindBefore}
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : Number(e.target.value);
                    setRemindBefore(val);
                    if (repeatEvery !== null && val !== null && repeatEvery >= val) {
                      setRepeatEvery(null);
                    }
                  }}
                  disabled={(!due && !isRecurring) || (isRecurring && !dueTime)}
                >
                  <option value="">
                    {(!due && !isRecurring) || (isRecurring && !dueTime)
                      ? "Select due first..."
                      : (isRecurring ? availableRecurringOffsets : availableOffsets).length === 0
                      ? "Due too soon"
                      : "Select reminder..."}
                  </option>
                  {(isRecurring ? availableRecurringOffsets : availableOffsets).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} before
                    </option>
                  ))}
                </select>
              </div>

              {/* Repeat Every */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "var(--gh-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Repeat Every
                  </label>
                </div>
                <select
                  className="add-task-input"
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    background: "var(--gh-bg)",
                    borderColor: "var(--gh-border)",
                    opacity: remindBefore === null ? 0.5 : 1,
                  }}
                  value={repeatEvery === null ? 0 : repeatEvery}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setRepeatEvery(val === 0 ? null : val);
                  }}
                  disabled={remindBefore === null || availableRepeatOptions.length === 0}
                >
                  {availableRepeatOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Total Reminders summary (one-time tasks) */}
            {!isRecurring && due && remindBefore !== null && schedulePreview.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(88, 166, 255, 0.08)",
                  border: "1px solid rgba(88, 166, 255, 0.2)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  color: "var(--gh-blue)",
                  fontWeight: "600",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span>Total Reminders: {totalReminders}</span>
              </div>
            )}

            {/* ── Overdue Notification Toggle ── */}
            {(isRecurring ? !!dueTime : !!due) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div
                  onClick={() => {
                    const next = !notifyOverdue;
                    setNotifyOverdue(next);
                    if (next && overdueRepeatEvery === null) {
                      setOverdueRepeatEvery(86400000); // 1 day
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--gh-bg)",
                    border: `1px solid ${notifyOverdue ? "var(--gh-red)" : "var(--gh-border)"}`,
                    borderRadius: "10px",
                    padding: "12px 14px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        background: notifyOverdue
                          ? "rgba(248, 81, 73, 0.15)"
                          : "rgba(139, 148, 158, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: notifyOverdue ? "var(--gh-red)" : "var(--gh-muted)",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--gh-text)" }}>
                        Overdue Notification
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--gh-muted)" }}>
                        {isRecurring ? "Notify me if not done by deadline" : "Notify me when task is overdue"}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "5px",
                      border: `2px solid ${notifyOverdue ? "var(--gh-red)" : "var(--gh-border)"}`,
                      background: notifyOverdue ? "var(--gh-red)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    {notifyOverdue && "✓"}
                  </div>
                </div>

                {notifyOverdue && (
                  <div style={{ marginLeft: "38px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "var(--gh-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      Repeat Notification
                    </label>
                    <select
                      className="add-task-input"
                      style={{
                        width: "100%",
                        fontSize: "13px",
                        background: "var(--gh-bg)",
                        borderColor: "var(--gh-border)",
                      }}
                      value={overdueRepeatEvery || 86400000}
                      onChange={(e) => setOverdueRepeatEvery(Number(e.target.value))}
                    >
                      {availableOverdueRepeatOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* ── Recurring Task Toggle ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                onClick={() => {
                  const turning = !isRecurring;
                  setIsRecurring(turning);
                  if (!turning) {
                    setDueTime("");
                  } else {
                    setDue("");
                    setRemindBefore(null);
                    setRepeatEvery(null);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--gh-bg)",
                  border: `1px solid ${isRecurring ? "var(--gh-blue)" : "var(--gh-border)"}`,
                  borderRadius: "10px",
                  padding: "12px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: isRecurring
                        ? "rgba(88, 166, 255, 0.15)"
                        : "rgba(139, 148, 158, 0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isRecurring ? "var(--gh-blue)" : "var(--gh-muted)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--gh-text)" }}>
                      Recurring Task
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--gh-muted)" }}>
                      Resets automatically on schedule
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "5px",
                    border: `2px solid ${isRecurring ? "var(--gh-blue)" : "var(--gh-border)"}`,
                    background: isRecurring ? "var(--gh-blue)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {isRecurring && "✓"}
                </div>
              </div>

              {isRecurring && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "var(--gh-surface2)",
                    border: "1px solid var(--gh-border)",
                  }}
                >
                  {/* Frequency selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)" }}>
                      Repeat Frequency
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {["daily", "weekly", "monthly"].map((freq) => {
                        const isSelected = recurrenceFrequency === freq;
                        return (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => {
                              setRecurrenceFrequency(freq);
                              setRecurrenceDays([]);
                            }}
                            style={{
                              flex: 1,
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              textTransform: "capitalize",
                              border: `1px solid ${isSelected ? "var(--gh-blue)" : "var(--gh-border)"}`,
                              background: isSelected ? "rgba(88, 166, 255, 0.15)" : "transparent",
                              color: isSelected ? "var(--gh-blue)" : "var(--gh-muted)",
                            }}
                          >
                            {freq}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Weekly Days Selector */}
                  {recurrenceFrequency === "weekly" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)" }}>
                        On these days
                      </label>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
                        {DAY_LABELS.map((day, idx) => {
                          const isSelected = recurrenceDays.includes(idx);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setRecurrenceDays(recurrenceDays.filter((d) => d !== idx));
                                } else {
                                  setRecurrenceDays([...recurrenceDays, idx]);
                                }
                              }}
                              style={{
                                flex: 1,
                                height: "32px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                border: `1px solid ${isSelected ? "var(--gh-blue)" : "var(--gh-border)"}`,
                                background: isSelected ? "rgba(88, 166, 255, 0.15)" : "transparent",
                                color: isSelected ? "var(--gh-blue)" : "var(--gh-muted)",
                              }}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Monthly Dates Selector */}
                  {recurrenceFrequency === "monthly" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--gh-muted)" }}>
                        On these dates
                      </label>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(7, 1fr)",
                          gap: "4px",
                        }}
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                          const isSelected = recurrenceDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setRecurrenceDays(recurrenceDays.filter((d) => d !== day));
                                } else {
                                  setRecurrenceDays([...recurrenceDays, day]);
                                }
                              }}
                              style={{
                                height: "28px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                                border: `1px solid ${isSelected ? "var(--gh-blue)" : "var(--gh-border)"}`,
                                background: isSelected ? "rgba(88, 166, 255, 0.15)" : "transparent",
                                color: isSelected ? "var(--gh-blue)" : "var(--gh-muted)",
                              }}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Info Note */}
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "rgba(88, 166, 255, 0.06)",
                      border: "1px solid rgba(88, 166, 255, 0.18)",
                      fontSize: "11px",
                      lineHeight: "1.5",
                      color: "var(--gh-muted)",
                    }}
                  >
                    📋 The task resets for the next period when completed or deadline passes.
                    <br />★ Consecutive completions maintain your streak.
                  </div>
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Notes
              </label>
              <textarea
                className="add-task-input"
                rows={3}
                style={{
                  width: "100%",
                  fontSize: "13px",
                  background: "var(--gh-bg)",
                  borderColor: "var(--gh-border)",
                  resize: "none",
                  minHeight: "70px",
                }}
                placeholder="Add some details about this task..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--gh-border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              background: "var(--gh-surface2)",
              borderRadius: "0 0 14px 14px",
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{ padding: "8px 16px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit}
              style={{
                padding: "8px 20px",
                opacity: canSubmit ? 1 : 0.5,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {initialTask ? "Update Task" : "Add Task"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
  projects = [],
  initialTask = null,
  defaultProject = null,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <AddTaskDialog
          key={initialTask?.id || "add-task-dialog"}
          onClose={onClose}
          onAdd={onAdd}
          projects={projects}
          initialTask={initialTask}
          defaultProject={defaultProject}
        />
      )}
    </AnimatePresence>
  );
}
