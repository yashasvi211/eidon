import React from "react";

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

const getDeadlineClass = (dueDate) => {
  if (!dueDate) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due-today";
  if (diffDays <= 2) return "due-urgent";
  if (diffDays <= 7) return "due-soon";
  return "due-safe";
};

const getDeadlineLabel = (dueDate) => {
  if (!dueDate) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return " · " + Math.abs(diffDays) + "d overdue";
  if (diffDays === 0) return " · Today";
  if (diffDays === 1) return " · Tomorrow";
  if (diffDays <= 7) return " · " + diffDays + "d left";
  return "";
};

const getSubtaskProgressClass = (done, total) => {
  if (total === 0) return "";
  const pct = (done / total) * 100;
  if (pct === 0) return "progress-none";
  if (pct < 40) return "progress-low";
  if (pct < 70) return "progress-mid";
  if (pct < 100) return "progress-high";
  return "progress-done";
};

export default function TaskItem({
  task,
  active,
  onSelect,
  onToggle,
  loggedTime,
  projects = [],
}) {
  const getProjectColor = (pName) => {
    const found = projects.find((proj) => proj.name === pName);
    return found ? found.color : "#bc8cff";
  };

  const pColor = getProjectColor(task.project);
  const isHex = pColor.startsWith("#");
  const borderColor = isHex ? `${pColor}4d` : "rgba(188, 140, 255, 0.3)";
  const backgroundColor = isHex ? `${pColor}14` : "rgba(188, 140, 255, 0.08)";
  const totalSeconds = (task.sessions || []).reduce(
    (acc, sess) => acc + (sess.end - sess.start) / 1000,
    0,
  );
  const subtasksDone = (task.subtasks || []).filter((s) => s.done).length;
  const totalSubtasks = (task.subtasks || []).length;

  return (
    <div
      className={`task-item ${active ? "active" : ""} ${task.done ? "done" : ""}`}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "12px 16px",
        cursor: "pointer",
        borderLeft: active
          ? "3px solid var(--gh-blue)"
          : "3px solid transparent",
        background: active ? "rgba(31,111,235,0.08)" : "transparent",
        opacity: task.done ? 0.5 : 1,
        transition: "all 0.15s ease",
        borderBottom: "1px solid var(--gh-border)",
      }}
    >
      <div
        className={`task-check ${task.done ? "done" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          border: "1.5px solid var(--gh-border2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: task.done ? "var(--gh-green-dim)" : "transparent",
          borderColor: task.done ? "var(--gh-green-dim)" : "var(--gh-border2)",
          flexShrink: 0,
        }}
      >
        {task.done && (
          <span style={{ color: "#fff", fontSize: "12px" }}>✓</span>
        )}
      </div>
      <div className="task-body" style={{ flex: 1 }}>
        <div
          className="task-title"
          style={{
            fontSize: "14px",
            fontWeight: active ? "500" : "400",
            textDecoration: task.done ? "line-through" : "none",
            color: task.done ? "var(--gh-muted)" : "var(--gh-text)",
          }}
        >
          {task.title}
        </div>
        <div
          className="task-meta"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
          }}
        >
          <span
            className="task-tag"
            style={{
              fontSize: "11px",
              color: pColor,
              borderColor: borderColor,
              background: backgroundColor,
            }}
          >
            {task.project}
          </span>
          {task.due && (
            <span className={`task-tag tag-due ${getDeadlineClass(task.due)}`} style={{ fontSize: "11px" }}>
              {fmtDateDisplay(task.due)}{getDeadlineLabel(task.due)}
            </span>
          )}
          {task.est && task.est !== "0h" && (
            <span className="task-tag tag-time" style={{ fontSize: "11px" }}>
              {task.est}
            </span>
          )}
          {totalSubtasks > 0 && (
            <span
              className={`task-tag tag-subtask ${getSubtaskProgressClass(subtasksDone, totalSubtasks)}`}
              style={{ fontSize: "11px" }}
            >
              ✓ {subtasksDone}/{totalSubtasks}
            </span>
          )}
        </div>
      </div>
      {totalSeconds > 0 && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "12px",
            color: "var(--gh-muted)",
            background: "var(--gh-surface2)",
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid var(--gh-border)",
          }}
        >
          {fmtSeconds(totalSeconds)}
        </div>
      )}
    </div>
  );
}
