import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
  projects = [],
}) {
  const [formData, setFormData] = useState({
    title: "",
    project: "Inbox",
    target: "today",
    est: "",
    due: "",
    notes: "",
  });

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: "",
        project: "Inbox",
        target: "today",
        est: "",
        due: "",
        notes: "",
      });
    }
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onAdd(formData);
    onClose();
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
          width: "520px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          maxHeight: "90vh",
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
          <h2 style={{ fontSize: "16px", fontWeight: "600" }}>Add New Task</h2>
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

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflowY: "auto",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                }}
              >
                Task Title
              </label>
              <input
                autoFocus
                className="add-task-input"
                style={{ width: "100%", fontSize: "14px" }}
                placeholder="What needs to be done?"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
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
                  Project
                </label>
                <select
                  className="add-task-input"
                  style={{ width: "100%", appearance: "none" }}
                  value={formData.project}
                  onChange={(e) =>
                    setFormData({ ...formData, project: e.target.value })
                  }
                >
                  {projects.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
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
                  Target View
                </label>
                <select
                  className="add-task-input"
                  style={{ width: "100%", appearance: "none" }}
                  value={formData.target}
                  onChange={(e) =>
                    setFormData({ ...formData, target: e.target.value })
                  }
                >
                  <option value="today">Today</option>
                  <option value="backlog">Backlog</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
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
                  Allocated Time
                </label>
                <input
                  className="add-task-input"
                  style={{ width: "100%", fontSize: "13px" }}
                  placeholder="e.g. 2h, 45m"
                  value={formData.est}
                  onChange={(e) =>
                    setFormData({ ...formData, est: e.target.value })
                  }
                />
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
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
                  Deadline
                </label>
                <input
                  type="date"
                  className="add-task-input"
                  style={{
                    width: "100%",
                    fontSize: "13px",
                    colorScheme: "dark",
                  }}
                  value={formData.due}
                  onChange={(e) =>
                    setFormData({ ...formData, due: e.target.value })
                  }
                />
              </div>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
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
                  resize: "none",
                  height: "auto",
                  minHeight: "80px",
                }}
                placeholder="Add some details about this task..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>

          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--gh-border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              background: "var(--gh-surface2)",
              borderRadius: "0 0 12px 12px",
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{ px: "16px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ px: "20px" }}
            >
              Add Task
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
