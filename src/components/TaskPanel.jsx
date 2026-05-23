import TaskItem from "./TaskItem";

export default function TaskPanel({
  tasks,
  timeLogs,
  selectedTaskId,
  setSelectedTaskId,
  toggleDone,
  handleQuickAdd,
  currentView,
  currentProject,
  projects = [],
  showCompleted = true,
}) {
  return (
    <div
      className="task-panel"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--gh-border)",
      }}
    >
      <div
        className="task-list"
        style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}
      >
        {(() => {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

          const isTaskBacklog = (t) => t.target === "backlog" || (t.due && t.due < todayStr);
          const isTaskCurrent = (t) => !isTaskBacklog(t) && (t.target === "today" || t.due === todayStr || (!t.due && t.target === "today"));

          const baseFiltered = tasks
            .filter((t) => {
              if (currentProject) return t.project === currentProject;
              
              const backlog = isTaskBacklog(t);
              if (currentView === "backlog") return backlog;
              if (currentView === "today") return !backlog && isTaskCurrent(t);
              return t.target === currentView && !backlog;
            })
            .filter((t) => {
              if (!showCompleted && t.done) return false;
              return true;
            });

          const renderList = (list) => list.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              active={selectedTaskId === task.id}
              onSelect={() => setSelectedTaskId(task.id)}
              onToggle={() => toggleDone(task.id)}
              loggedTime={timeLogs
                .filter((l) => l.taskId === task.id)
                .reduce((a, l) => a + l.seconds, 0)}
              projects={projects}
            />
          ));

          if (currentProject) {
            const backlogTasks = baseFiltered.filter(isTaskBacklog);
            const currentTasks = baseFiltered.filter(isTaskCurrent);
            const futureTasks = baseFiltered.filter(t => !isTaskBacklog(t) && !isTaskCurrent(t));

            return (
              <div>
                {backlogTasks.length > 0 && (
                  <div className="project-section">
                    <div style={{ padding: "8px 16px", fontSize: "12px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Backlog</div>
                    {renderList(backlogTasks)}
                  </div>
                )}
                {currentTasks.length > 0 && (
                  <div className="project-section">
                    <div style={{ padding: "8px 16px", fontSize: "12px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Current</div>
                    {renderList(currentTasks)}
                  </div>
                )}
                {futureTasks.length > 0 && (
                  <div className="project-section">
                    <div style={{ padding: "8px 16px", fontSize: "12px", fontWeight: "600", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Future Date</div>
                    {renderList(futureTasks)}
                  </div>
                )}
                {baseFiltered.length === 0 && (
                  <div style={{ padding: "16px", color: "var(--gh-muted)", fontSize: "13px", textAlign: "center" }}>No tasks in this project.</div>
                )}
              </div>
            );
          }

          return renderList(baseFiltered);
        })()}
      </div>
    </div>
  );
}
