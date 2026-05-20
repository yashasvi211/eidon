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

export default function TaskItem({
  task,
  active,
  onSelect,
  onToggle,
  loggedTime,
}) {
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
        alignItems: "flex-start",
        gap: "10px",
        padding: "8px 16px",
        cursor: "pointer",
        borderLeft: active
          ? "2px solid var(--gh-blue)"
          : "2px solid transparent",
        background: active ? "rgba(31,111,235,0.08)" : "transparent",
        opacity: task.done ? 0.5 : 1,
      }}
    >
      <div
        className={`task-check ${task.done ? "done" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          border: "1.5px solid var(--gh-border2)",
          marginTop: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: task.done ? "var(--gh-green-dim)" : "transparent",
          borderColor: task.done ? "var(--gh-green-dim)" : "var(--gh-border2)",
        }}
      >
        {task.done && (
          <span style={{ color: "#fff", fontSize: "10px" }}>✓</span>
        )}
      </div>
      <div className="task-body" style={{ flex: 1 }}>
        <div
          className="task-title"
          style={{
            fontSize: "13px",
            textDecoration: task.done ? "line-through" : "none",
          }}
        >
          {task.title}
        </div>
        <div
          className="task-meta"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <span className="task-tag tag-project">{task.project}</span>
          {task.due && (
            <span className="task-tag tag-due">{fmtDateDisplay(task.due)}</span>
          )}
          {task.est && task.est !== "0h" && (
            <span className="task-tag tag-time">{task.est}</span>
          )}
          {totalSubtasks > 0 && (
            <span
              className="task-tag"
              style={{
                color: "var(--gh-orange)",
                borderColor: "rgba(227,179,65,0.3)",
                background: "rgba(227,179,65,0.08)",
              }}
            >
              {subtasksDone}/{totalSubtasks}
            </span>
          )}
        </div>
      </div>
      {totalSeconds > 0 && (
        <span
          className="task-timer"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "11px",
            color: "var(--gh-muted)",
          }}
        >
          {fmtSeconds(totalSeconds)}
        </span>
      )}
    </div>
  );
}
