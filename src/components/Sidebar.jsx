import React from "react";

function NavItem({ active, onClick, icon, label, badge }) {
  return (
    <div
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 8px",
        borderRadius: "6px",
        cursor: "pointer",
        color: active ? "var(--gh-text)" : "var(--gh-muted)",
        fontSize: "13px",
        transition: "all 0.15s",
        background: active ? "var(--gh-surface2)" : "transparent",
        position: "relative",
      }}
    >
      {React.cloneElement(icon, {
        style: { width: "16px", height: "16px", opacity: active ? 1 : 0.7 },
      })}
      {label}
      {badge !== undefined && (
        <span
          className="nav-badge"
          style={{
            marginLeft: "auto",
            background: "var(--gh-surface)",
            border: "1px solid var(--gh-border)",
            borderRadius: "20px",
            padding: "1px 6px",
            fontFamily: "var(--mono)",
            fontSize: "10px",
          }}
        >
          {badge}
        </span>
      )}
      {active && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "20%",
            bottom: "20%",
            width: "2px",
            background: "var(--gh-blue)",
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}
    </div>
  );
}

function ProjectItem({ color, label, active, onClick, onDelete }) {
  return (
    <div
      className="project-item"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "5px 8px",
        borderRadius: "6px",
        cursor: "pointer",
        color: active ? "var(--gh-text)" : "var(--gh-muted)",
        fontSize: "13px",
        background: active ? "var(--gh-surface2)" : "transparent",
        transition: "all 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        const delBtn = e.currentTarget.querySelector(".delete-project-btn");
        if (delBtn) delBtn.style.opacity = 1;
      }}
      onMouseLeave={(e) => {
        const delBtn = e.currentTarget.querySelector(".delete-project-btn");
        if (delBtn) delBtn.style.opacity = 0;
      }}
    >
      <div
        className="project-dot"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
        }}
      />
      <span
        style={{
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      {label !== "Inbox" && (
        <button
          className="delete-project-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(label);
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--gh-muted)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            borderRadius: "4px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--gh-red)";
            e.currentTarget.style.background = "rgba(248, 81, 73, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--gh-muted)";
            e.currentTarget.style.background = "none";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75a1.75 1.75 0 011.75-1.75h2.5A1.75 1.75 0 0111 1.75zm-1.25 13.25a.75.75 0 00.75-.75V6.75a.75.75 0 00-1.5 0v7.5a.75.75 0 00.75.75zM6.25 6.75a.75.75 0 00-1.5 0v7.5a.75.75 0 001.5 0v-7.5z" />
          </svg>
        </button>
      )}
      {active && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "20%",
            bottom: "20%",
            width: "2px",
            background: "var(--gh-blue)",
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}
    </div>
  );
}

const TodayIcon = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
  </svg>
);
const ScheduledIcon = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0114.25 13H8.06l-2.573 2.573A1.457 1.457 0 013 14.543V13H1.75A1.75 1.75 0 010 11.25v-9.5z" />
  </svg>
);
const TimeIcon = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zm.75 4.75a.75.75 0 00-1.5 0v3.5l-1.804 1.354a.75.75 0 00.902 1.2l2-1.5A.75.75 0 008.75 8.5V4.75z"
    />
  </svg>
);
const BacklogIcon = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4.414a2 2 0 01-1.414-.586l-2-2A2 2 0 010 8V2zm5.5 3a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-5z" />
  </svg>
);
const StatsIcon = (props) => (
  <svg {...props} viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 13h16v2H0v-2zm2-8h3v7H2V5zm5-4h2v11H7V1zm5 5h2v6h-2V6z" />
  </svg>
);

export default function Sidebar({
  currentView,
  setCurrentView,
  tasks,
  currentProject,
  setCurrentProject,
  projects = [],
  onAddProject,
  onDeleteProject,
  onOpenSettings,
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState("");
  const [newProjectColor, setNewProjectColor] = React.useState("#58a6ff");

  const CURATED_COLORS = [
    "#58a6ff", // Blue
    "#3fb950", // Green
    "#bc8cff", // Purple
    "#ff7b72", // Red
    "#e3b341", // Orange/Amber
    "#db61a2", // Pink
    "#f2cc60", // Yellow
    "#8b949e", // Grey
  ];

  const handleSave = () => {
    if (!newProjectName.trim()) return;
    onAddProject(newProjectName.trim(), newProjectColor);
    setNewProjectName("");
    setIsAdding(false);
  };

  const handleCancel = () => {
    setNewProjectName("");
    setIsAdding(false);
  };

  return (
    <aside
      className="sidebar"
      style={{
        width: "240px",
        background: "var(--gh-surface)",
        borderRight: "1px solid var(--gh-border)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="nav-section" style={{ padding: "24px 8px 4px" }}>
        <div
          className="nav-label"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "10px",
            color: "var(--gh-muted)",
            textTransform: "uppercase",
            padding: "0 8px 6px",
          }}
        >
          Workspace
        </div>
        <NavItem
          active={currentView === "today" && !currentProject}
          onClick={() => {
            setCurrentView("today");
            setCurrentProject(null);
          }}
          icon={<TodayIcon />}
          label="Today's Tasks"
          badge={tasks.filter((t) => t.target === "today" && !t.done).length}
        />
        <NavItem
          active={currentView === "scheduled"}
          onClick={() => {
            setCurrentView("scheduled");
            setCurrentProject(null);
          }}
          icon={<ScheduledIcon />}
          label="Scheduled"
        />
        <NavItem
          active={currentView === "timetracking"}
          onClick={() => {
            setCurrentView("timetracking");
            setCurrentProject(null);
          }}
          icon={<TimeIcon />}
          label="Time Tracking"
        />
        <NavItem
          active={currentView === "stats"}
          onClick={() => {
            setCurrentView("stats");
            setCurrentProject(null);
          }}
          icon={<StatsIcon />}
          label="Deep Stats"
        />
        <NavItem
          active={currentView === "backlog" && !currentProject}
          onClick={() => {
            setCurrentView("backlog");
            setCurrentProject(null);
          }}
          icon={<BacklogIcon />}
          label="Backlog"
          badge={tasks.filter((t) => t.target === "backlog" && !t.done).length}
        />
      </div>

      <div className="nav-section" style={{ padding: "12px 8px 4px" }}>
        <div
          className="nav-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px 6px",
          }}
        >
          <div
            className="nav-label"
            style={{
              fontFamily: "var(--mono)",
              fontSize: "10px",
              color: "var(--gh-muted)",
              textTransform: "uppercase",
            }}
          >
            Projects
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--gh-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px",
              borderRadius: "4px",
              transition: "all 0.15s ease",
            }}
            title="Add New Project"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--gh-text)";
              e.currentTarget.style.background = "var(--gh-surface2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--gh-muted)";
              e.currentTarget.style.background = "none";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z" />
            </svg>
          </button>
        </div>

        {isAdding && (
          <div
            style={{
              padding: "10px",
              background: "var(--gh-surface2)",
              border: "1px solid var(--gh-border2)",
              borderRadius: "6px",
              marginBottom: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                justifyContent: "center",
              }}
            >
              {CURATED_COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => setNewProjectColor(c)}
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: c,
                    cursor: "pointer",
                    border:
                      newProjectColor === c
                        ? "2px solid #fff"
                        : "1px solid rgba(255,255,255,0.1)",
                    boxShadow:
                      newProjectColor === c
                        ? "0 0 0 1px var(--gh-blue)"
                        : "none",
                    transform:
                      newProjectColor === c ? "scale(1.15)" : "scale(1)",
                    transition: "all 0.15s ease",
                  }}
                  title={c}
                />
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--gh-surface)",
                border: "1px solid var(--gh-border)",
                borderRadius: "6px",
                padding: "4px 8px",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: newProjectColor,
                  flexShrink: 0,
                  transition: "background 0.25s ease",
                }}
              />
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSave();
                  } else if (e.key === "Escape") {
                    handleCancel();
                  }
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--gh-text)",
                  fontFamily: "var(--sans)",
                  fontSize: "13px",
                  outline: "none",
                  flex: 1,
                  padding: "2px 0",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "6px",
              }}
            >
              <button
                onClick={handleCancel}
                style={{
                  background: "none",
                  border: "1px solid var(--gh-border)",
                  borderRadius: "4px",
                  color: "var(--gh-muted)",
                  fontSize: "11px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  transition: "all 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--gh-border2)";
                  e.currentTarget.style.color = "var(--gh-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--gh-border)";
                  e.currentTarget.style.color = "var(--gh-muted)";
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  background: "var(--gh-green-dim)",
                  border: "none",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "600",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  transition: "all 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--gh-green)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--gh-green-dim)";
                }}
              >
                Create
              </button>
            </div>
          </div>
        )}

        {projects.map((proj) => (
          <ProjectItem
            key={proj.name}
            color={proj.color}
            label={proj.name}
            active={currentProject === proj.name}
            onClick={() => {
              setCurrentProject(proj.name);
              if (currentView !== "today" && currentView !== "backlog") {
                setCurrentView("today");
              }
            }}
            onDelete={onDeleteProject}
          />
        ))}
      </div>

      <div
        className="sidebar-footer"
        style={{
          marginTop: "auto",
          padding: "12px",
          borderTop: "1px solid var(--gh-border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          className="user-avatar"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "var(--gh-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "600",
            color: "#fff",
          }}
        >
          JD
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--gh-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            John Doe
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--gh-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Free Plan
          </div>
        </div>
        <div
          className="settings-btn"
          onClick={onOpenSettings}
          style={{
            padding: "6px",
            borderRadius: "6px",
            cursor: "pointer",
            color: "var(--gh-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--gh-surface2)";
            e.currentTarget.style.color = "var(--gh-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--gh-muted)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 11.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-1.5a2 2 0 100-4 2 2 0 000 4z" />
            <path d="M12.87 6.42a.5.5 0 01.31.6l-.37 1.35c.02.21.02.43 0 .64l.37 1.35a.5.5 0 01-.31.6l-1.45.47c-.12.18-.27.35-.43.5l.07 1.53a.5.5 0 01-.45.52l-1.5.07c-.18.12-.38.21-.59.28l-.5 1.45a.5.5 0 01-.6.31l-1.35-.37c-.21.02-.43.02-.64 0l-1.35.37a.5.5 0 01-.6-.31l-.47-1.45c-.21-.07-.41-.16-.59-.28l-1.5-.07a.5.5 0 01-.45-.52l.07-1.53c-.16-.15-.31-.32-.43-.5l-1.45-.47a.5.5 0 01-.31-.6l.37-1.35c-.02-.21-.02-.43 0-.64l-.37-1.35a.5.5 0 01.31-.6l1.45-.47c.12-.18.27-.35.43-.5l-.07-1.53a.5.5 0 01.45-.52l1.5-.07c.18-.12.38-.21.59-.28l.5-1.45a.5.5 0 01.6-.31l1.35.37c.21-.02.43-.02.64 0l1.35-.37a.5.5 0 01.6.31l.47 1.45c.21.07.41.16.59.28l1.5.07a.5.5 0 01.45.52l-.07 1.53c.16.15.31.32.43.5l1.45.47z" />
          </svg>
        </div>
      </div>
    </aside>
  );
}
