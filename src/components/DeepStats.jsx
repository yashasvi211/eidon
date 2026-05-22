import React, { useMemo, useState } from "react";

const fmtSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
};

const parseEstimate = (est) => {
  if (!est) return 0;
  let total = 0;
  const hMatch = est.match(/(\d+\.?\d*)h/);
  const mMatch = est.match(/(\d+)m/);
  if (hMatch) total += parseFloat(hMatch[1]) * 3600;
  if (mMatch) total += parseInt(mMatch[1]) * 60;
  return total;
};

const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

export default function DeepStats({ tasks }) {
  const [viewType, setViewType] = useState("daily"); // 'daily' | 'weekly'
  const [projectFilter, setProjectFilter] = useState("All");

  const projects = useMemo(() => {
    const pSet = new Set(["All"]);
    tasks.forEach((t) => {
      if (t.project) pSet.add(t.project);
    });
    return Array.from(pSet);
  }, [tasks]);

  const stats = useMemo(() => {
    const filteredTasks =
      projectFilter === "All"
        ? tasks
        : tasks.filter((t) => t.project === projectFilter);

    let totalAllocated = 0;
    let totalWorked = 0;
    let totalWindows = 0;
    let taskBreakdown = [];
    let groupedTime = {}; // { key: { worked, allocated, windows } }

    filteredTasks.forEach((task) => {
      const alloc = parseEstimate(task.est);
      const sessions = task.sessions || [];
      const worked = sessions.reduce(
        (acc, s) => acc + (s.end - s.start) / 1000,
        0,
      );
      const windows = sessions.length;

      totalAllocated += alloc;
      totalWorked += worked;
      totalWindows += windows;

      taskBreakdown.push({
        title: task.title,
        worked,
        alloc,
        windows,
        project: task.project,
      });

      sessions.forEach((sess) => {
        const date = new Date(sess.start);
        let key;
        if (viewType === "daily") {
          key = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        } else {
          const week = getWeekNumber(date);
          key = `Week ${week}, ${date.getFullYear()}`;
        }

        if (!groupedTime[key]) {
          groupedTime[key] = { worked: 0, windows: 0, date: date.getTime() };
        }
        groupedTime[key].worked += (sess.end - sess.start) / 1000;
        groupedTime[key].windows += 1;
      });
    });

    const timeline = Object.entries(groupedTime)
      .sort((a, b) => b[1].date - a[1].date)
      .map(([key, data]) => ({ key, ...data }));

    return {
      totalAllocated,
      totalWorked,
      totalWindows,
      taskBreakdown,
      timeline,
    };
  }, [tasks, viewType, projectFilter]);

  return (
    <div
      className="view-stats"
      style={{
        flex: 1,
        padding: "24px",
        overflowY: "auto",
        background: "var(--gh-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: "600" }}>Deep Stats</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="btn"
            onClick={() => setViewType("daily")}
            style={{
              background:
                viewType === "daily" ? "var(--gh-surface2)" : "transparent",
              borderColor:
                viewType === "daily" ? "var(--gh-blue)" : "var(--gh-border)",
            }}
          >
            Daily
          </button>
          <button
            className="btn"
            onClick={() => setViewType("weekly")}
            style={{
              background:
                viewType === "weekly" ? "var(--gh-surface2)" : "transparent",
              borderColor:
                viewType === "weekly" ? "var(--gh-blue)" : "var(--gh-border)",
            }}
          >
            Weekly
          </button>
        </div>
      </div>

      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {projects.map((p) => (
          <button
            key={p}
            className="btn"
            onClick={() => setProjectFilter(p)}
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              background:
                projectFilter === p
                  ? "rgba(31,111,235,0.1)"
                  : "var(--gh-surface)",
              borderColor:
                projectFilter === p ? "var(--gh-blue)" : "var(--gh-border)",
              color: projectFilter === p ? "var(--gh-blue)" : "var(--gh-muted)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="stats-section">
        <div className="nav-label" style={{ marginBottom: "12px" }}>
          {projectFilter} Project Overview
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <StatCard
            label="Total Allocated"
            value={fmtSeconds(stats.totalAllocated)}
            sub="based on estimates"
            highlight="var(--gh-amber)"
          />
          <StatCard
            label="Total Worked"
            value={fmtSeconds(stats.totalWorked)}
            sub="actual tracking"
            highlight="var(--gh-green)"
          />
          <StatCard
            label="Total Windows"
            value={stats.totalWindows}
            sub="tracking sessions"
            highlight="var(--gh-blue)"
          />
          <StatCard
            label="Task Count"
            value={stats.taskBreakdown.length}
            sub="in this view"
            highlight="var(--gh-purple)"
          />
        </div>
      </div>

      <div className="stats-section">
        <div className="nav-label" style={{ marginBottom: "12px" }}>
          Time {viewType === "daily" ? "Days" : "Weeks"}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "32px",
          }}
        >
          {stats.timeline.map((item, i) => (
            <div
              key={i}
              style={{
                background: "var(--gh-surface)",
                border: "1px solid var(--gh-border)",
                borderRadius: "8px",
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: "600", fontSize: "14px" }}>
                  {item.key}
                </div>
                <div style={{ fontSize: "11px", color: "var(--gh-muted)" }}>
                  {item.windows} sessions
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    color: "var(--gh-green)",
                    fontWeight: "600",
                    fontFamily: "var(--mono)",
                    fontSize: "14px",
                  }}
                >
                  {fmtSeconds(item.worked)}
                </div>
              </div>
            </div>
          ))}
          {stats.timeline.length === 0 && (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--gh-muted)",
                border: "1px dashed var(--gh-border)",
                borderRadius: "8px",
              }}
            >
              No data for the selected period
            </div>
          )}
        </div>
      </div>

      <div className="stats-section">
        <div className="nav-label" style={{ marginBottom: "12px" }}>
          Task Breakdown ({projectFilter})
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            marginBottom: "32px",
          }}
        >
          {stats.taskBreakdown
            .filter((t) => t.worked > 0 || t.alloc > 0)
            .map((task, i) => (
              <div
                key={i}
                style={{
                  background: "var(--gh-surface)",
                  border: "1px solid var(--gh-border)",
                  borderRadius: "12px",
                  padding: "24px 28px",
                  transition: "all 0.15s ease",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "17px",
                        marginBottom: "4px",
                      }}
                    >
                      {task.title}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--gh-purple)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: "500",
                      }}
                    >
                      {task.project}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--gh-muted)",
                      fontFamily: "var(--mono)",
                      background: "var(--gh-surface2)",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--gh-border)",
                    }}
                  >
                    {task.windows} windows
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    fontSize: "14px",
                    marginBottom: "16px",
                    fontFamily: "var(--mono)",
                  }}
                >
                  <span style={{ color: "var(--gh-green)", fontWeight: "500" }}>
                    {fmtSeconds(task.worked)} worked
                  </span>
                  <span style={{ color: "var(--gh-amber)", fontWeight: "500" }}>
                    {fmtSeconds(task.alloc)} alloc
                  </span>
                </div>
                <div
                  style={{
                    height: "8px",
                    background: "var(--gh-border)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${task.alloc > 0 ? Math.min(100, (task.worked / task.alloc) * 100) : 0}%`,
                      background: "var(--gh-blue)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }) {
  return (
    <div
      style={{
        background: "var(--gh-surface)",
        border: "1px solid var(--gh-border)",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "var(--gh-muted)",
          fontFamily: "var(--mono)",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: "600",
          color: highlight,
          marginBottom: "4px",
          fontFamily: "var(--mono)",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "var(--gh-muted)" }}>{sub}</div>
    </div>
  );
}
