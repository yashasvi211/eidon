import React, { useEffect } from "react";
import { motion } from "framer-motion";
import "../App.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableProjectItem({
  proj,
  index,
  onDeleteProject,
  moveProject,
  projectsCount,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: proj.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 12px",
    background: "var(--gh-surface2)",
    border: "1px solid var(--gh-border)",
    borderRadius: "6px",
    marginBottom: "8px",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        {...listeners}
        style={{
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          color: "var(--gh-muted)",
        }}
        title="Drag to reorder"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 4a1 1 0 11-2 0 1 1 0 012 0zm5 0a1 1 0 11-2 0 1 1 0 012 0zm-5 4a1 1 0 11-2 0 1 1 0 012 0zm5 0a1 1 0 11-2 0 1 1 0 012 0zm-5 4a1 1 0 11-2 0 1 1 0 012 0zm5 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      </div>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: "11px",
          color: "var(--gh-muted)",
          width: "16px",
        }}
      >
        {index + 1}.
      </span>
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: proj.color,
        }}
      />
      <span style={{ flex: 1, fontSize: "13px" }}>{proj.name}</span>
      <div style={{ display: "flex", gap: "6px" }}>
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            onClick={() => moveProject(index, -1)}
            disabled={index === 0}
            title="Move Up"
            style={{
              background: "none",
              border: "1px solid var(--gh-border2)",
              color: "var(--gh-muted)",
              borderRadius: "4px",
              padding: "2px 6px",
              cursor: index === 0 ? "not-allowed" : "pointer",
              opacity: index === 0 ? 0.3 : 1,
            }}
          >
            ↑
          </button>
          <button
            onClick={() => moveProject(index, 1)}
            disabled={index === projectsCount - 1}
            title="Move Down"
            style={{
              background: "none",
              border: "1px solid var(--gh-border2)",
              color: "var(--gh-muted)",
              borderRadius: "4px",
              padding: "2px 6px",
              cursor: index === projectsCount - 1 ? "not-allowed" : "pointer",
              opacity: index === projectsCount - 1 ? 0.3 : 1,
            }}
          >
            ↓
          </button>
        </div>
        {proj.name !== "Inbox" && (
          <button
            onClick={() => onDeleteProject(proj.name)}
            title="Delete Project"
            style={{
              background: "none",
              border: "1px solid var(--gh-red)",
              color: "var(--gh-red)",
              borderRadius: "4px",
              padding: "2px 6px",
              cursor: "pointer",
              opacity: 0.8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.8)}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75a1.75 1.75 0 011.75-1.75h2.5A1.75 1.75 0 0111 1.75zm-1.25 13.25a.75.75 0 00.75-.75V6.75a.75.75 0 00-1.5 0v7.5a.75.75 0 00.75.75zM6.25 6.75a.75.75 0 00-1.5 0v7.5a.75.75 0 001.5 0v-7.5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
  projects,
  setProjects,
  settings,
  setSettings,
  onDeleteProject,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p.name === active.id);
      const newIndex = projects.findIndex((p) => p.name === over.id);
      setProjects(arrayMove(projects, oldIndex, newIndex));
    }
  };

  const moveProject = (index, direction) => {
    const newProjects = [...projects];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newProjects.length) return;
    const temp = newProjects[index];
    newProjects[index] = newProjects[targetIndex];
    newProjects[targetIndex] = temp;
    setProjects(newProjects);
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.9, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 15, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "var(--gh-surface)",
          border: "1px solid var(--gh-border)",
          borderRadius: "12px",
          width: "480px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--gh-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--gh-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          <section style={{ marginBottom: "24px", borderBottom: "1px solid var(--gh-border)", paddingBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--gh-muted)",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Sleep Schedule
            </label>
            <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--gh-muted)", marginBottom: "4px" }}>Sleep Start</label>
                <input
                  type="time"
                  value={settings.sleepStart || "22:00"}
                  onChange={(e) => setSettings({ ...settings, sleepStart: e.target.value })}
                  style={{
                    width: "100%",
                    background: "var(--gh-surface2)",
                    border: "1px solid var(--gh-border2)",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: "var(--gh-text)",
                    fontSize: "13px"
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--gh-muted)", marginBottom: "4px" }}>Wake Up</label>
                <input
                  type="time"
                  value={settings.sleepEnd || "07:00"}
                  onChange={(e) => setSettings({ ...settings, sleepEnd: e.target.value })}
                  style={{
                    width: "100%",
                    background: "var(--gh-surface2)",
                    border: "1px solid var(--gh-border2)",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: "var(--gh-text)",
                    fontSize: "13px"
                  }}
                />
              </div>
            </div>
          </section>

          <section style={{ marginBottom: "24px", borderBottom: "1px solid var(--gh-border)", paddingBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--gh-text)",
                    marginBottom: "4px",
                  }}
                >
                  Show Completed Tasks
                </label>
                <span style={{ fontSize: "11px", color: "var(--gh-muted)" }}>
                  Display finished tasks in your lists
                </span>
              </div>
              <div
                onClick={() => setSettings({ ...settings, showCompleted: settings.showCompleted !== false ? false : true })}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "12px",
                  background: settings.showCompleted !== false ? "var(--gh-blue)" : "var(--gh-surface2)",
                  border: "1px solid var(--gh-border2)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease, border-color 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <motion.div
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "var(--gh-text)",
                    position: "absolute",
                    left: settings.showCompleted !== false ? "22px" : "3px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  }}
                />
              </div>
            </div>
          </section>

          <section style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                }}
              >
                Application Size
              </label>
              <button
                onClick={() => setSettings({ ...settings, appSize: 100 })}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--gh-blue)",
                  fontSize: "11px",
                  cursor: "pointer",
                  padding: "0",
                }}
              >
                Reset
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input
                type="range"
                min="80"
                max="120"
                step="5"
                value={settings.appSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    appSize: parseInt(e.target.value),
                  })
                }
                style={{
                  flex: 1,
                  accentColor: "var(--gh-blue)",
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--mono)",
                  width: "45px",
                  textAlign: "right",
                }}
              >
                {settings.appSize}%
              </span>
            </div>
          </section>

          <section>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--gh-muted)",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Manage Projects (Drag or use arrows)
            </label>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={projects.map((p) => p.name)}
                strategy={verticalListSortingStrategy}
              >
                <div>
                  {projects.map((proj, index) => (
                    <SortableProjectItem
                      key={proj.name}
                      proj={proj}
                      index={index}
                      onDeleteProject={onDeleteProject}
                      moveProject={moveProject}
                      projectsCount={projects.length}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--gh-border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
