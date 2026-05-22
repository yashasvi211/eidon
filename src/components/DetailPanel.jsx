import React, { useState, useEffect, useRef } from "react";

const fmtDateDisplay = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[parseInt(m) - 1] + " " + parseInt(d) + ", " + y;
};

const fmtSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
};

const fmtTimer = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

const PROJECT_COLORS = {
  "HubSpot Integration": "#58a6ff",
  "Bill of Material": "#3fb950",
  "GitHub Logs Backup": "#bc8cff",
  Inbox: "#8b949e",
};

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

export default function DetailPanel({
  selectedTask,
  tasks,
  setTasks,
  isTimerRunning,
  onStartTimer,
  onStopTimer,
  timerSeconds,
  projects = [],
}) {
  const projectColor = (p) => {
    const found = projects.find((proj) => proj.name === p);
    return found ? found.color : (PROJECT_COLORS[p] || "#8b949e");
  };
  const [newSubtask, setNewSubtask] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [selectedTask.notes, selectedTask.id]);

  if (!selectedTask)
    return (
      <div
        className="detail-panel"
        style={{
          width: "400px",
          background: "var(--gh-surface)",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          color: "var(--gh-muted)",
        }}
      >
        Select a task to see details
      </div>
    );

  const totalSpent = (selectedTask.sessions || []).reduce(
    (acc, sess) => acc + (sess.end - sess.start) / 1000,
    0,
  );

  const toggleSubtask = (subId) => {
    setTasks(
      tasks.map((t) =>
        t.id === selectedTask.id
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subId ? { ...s, done: !s.done } : s,
              ),
            }
          : t,
      ),
    );
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const sub = { id: "s" + Date.now(), title: newSubtask, done: false };
    setTasks(
      tasks.map((t) =>
        t.id === selectedTask.id
          ? {
              ...t,
              subtasks: [...t.subtasks, sub],
            }
          : t,
      ),
    );
    setNewSubtask("");
  };

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
        className="detail-header"
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--gh-border)",
        }}
      >
        <div
          className="detail-title"
          style={{ fontSize: "15px", fontWeight: "600", marginBottom: "10px" }}
        >
          {selectedTask.title}
        </div>
        <div className="detail-actions" style={{ display: "flex", gap: "6px" }}>
          {!isTimerRunning ? (
            <button className="btn btn-primary" onClick={onStartTimer}>
              ▶ Start Timer
            </button>
          ) : (
            <button className="btn btn-danger" onClick={onStopTimer}>
              ⏹ Stop Timer
            </button>
          )}
          <button className="btn btn-danger">✕ Delete</button>
        </div>
      </div>

      <div
        className="detail-body"
        style={{ flex: 1, overflowY: "auto", padding: "16px" }}
      >
        <DetailSection label="Task Details">
          <DetailRow
            label="Project"
            value={selectedTask.project}
            color={projectColor(selectedTask.project)}
          />
          <DetailRow
            label="Due Date"
            value={fmtDateDisplay(selectedTask.due)}
          />
          <DetailRow label="Estimated" value={selectedTask.est} />
          <DetailRow
            label="Time Spent"
            value={fmtSeconds(totalSpent)}
            color="var(--gh-green)"
          />
        </DetailSection>

        <DetailSection label="Task Breakdown">
          <div className="subtask-list" style={{ marginBottom: "10px" }}>
            {(selectedTask.subtasks || []).map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 0",
                  borderBottom: "1px solid var(--gh-border)",
                  fontSize: "13px",
                  opacity: s.done ? 0.5 : 1,
                }}
              >
                <div
                  onClick={() => toggleSubtask(s.id)}
                  style={{
                    width: "14px",
                    height: "14px",
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
                    <span style={{ color: "#fff", fontSize: "8px" }}>✓</span>
                  )}
                </div>
                <span
                  style={{ textDecoration: s.done ? "line-through" : "none" }}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              className="add-task-input"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubtask()}
              placeholder="Add subtask..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={addSubtask}
              style={{ padding: "2px 8px" }}
            >
              +
            </button>
          </div>
        </DetailSection>

        <DetailSection label="Time Tracking Sessions">
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <div
              style={{
                flex: 1,
                background: "var(--gh-surface2)",
                padding: "10px",
                borderRadius: "8px",
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
                  fontSize: "14px",
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
                padding: "10px",
                borderRadius: "8px",
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
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--gh-blue)",
                }}
              >
                {(selectedTask.sessions || []).length}
              </div>
            </div>
          </div>

          <div
            className="session-list"
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          >
            {(selectedTask.sessions || [])
              .slice()
              .reverse()
              .map((sess, i) => (
                <div
                  key={sess.id}
                  className="session-window"
                  style={{
                    background: "var(--gh-surface2)",
                    border: "1px solid var(--gh-border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      minWidth: "65px",
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      color: "var(--gh-green)",
                      fontWeight: "600",
                      background: "rgba(63,185,80,0.1)",
                      padding: "6px 4px",
                      borderRadius: "6px",
                      textAlign: "center",
                    }}
                  >
                    {fmtSeconds((sess.end - sess.start) / 1000)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
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
                </div>
              ))}
          </div>
        </DetailSection>

        <DetailSection label="Notes">
          <textarea
            className="notes-area"
            ref={textareaRef}
            value={selectedTask.notes}
            onChange={(e) =>
              setTasks(
                tasks.map((t) =>
                  t.id === selectedTask.id
                    ? { ...t, notes: e.target.value }
                    : t,
                ),
              )
            }
            placeholder="Add notes..."
            style={{
              width: "100%",
              background: "var(--gh-surface2)",
              border: "1px solid var(--gh-border)",
              borderRadius: "6px",
              padding: "10px",
              color: "var(--gh-text)",
              fontFamily: "var(--mono)",
              fontSize: "13px",
              outline: "none",
              resize: "none",
              overflow: "hidden",
            }}
          />
        </DetailSection>
      </div>

      {isTimerRunning && (
        <div
          className="timer-widget"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--gh-border)",
            background: "var(--gh-surface2)",
          }}
        >
          <div
            className="timer-display"
            style={{
              fontFamily: "var(--mono)",
              fontSize: "28px",
              fontWeight: "600",
              color: "var(--gh-green)",
              textAlign: "center",
            }}
          >
            {fmtTimer(timerSeconds)}
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: "10px",
              color: "var(--gh-muted)",
              marginTop: "4px",
              fontFamily: "var(--mono)",
            }}
          >
            Active Session:{" "}
            {new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      )}
    </div>
  );
}
