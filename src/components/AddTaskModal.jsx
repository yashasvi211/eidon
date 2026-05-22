import React, { useState, useEffect } from "react";

export default function AddTaskModal({ isOpen, onClose, onAdd, projects = [] }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  const [formData, setFormData] = useState({
    title: "",
    project: "Inbox",
    target: "today",
    due: "",
    est: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
      // Wait for animation to finish (0.3s) before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onAdd(formData);
    setFormData({
      title: "",
      project: "Inbox",
      target: "today",
      due: "",
      est: "",
      notes: "",
    });
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div
      className={`modal-overlay ${isAnimating ? "fade-in" : "fade-out"}`}
      onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="modal"
        style={{
          background: "var(--gh-surface)",
          border: "1px solid var(--gh-border2)",
          borderRadius: "12px",
          width: "480px",
          maxWidth: "95vw",
          overflow: "hidden",
        }}
      >
        <div
          className="modal-header"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--gh-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            className="modal-title"
            style={{ fontWeight: "600", fontSize: "15px" }}
          >
            Add New Task
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--gh-muted)",
              cursor: "pointer",
              fontSize: "18px",
            }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div
            className="modal-body"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div
              className="form-group"
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                className="form-label"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                }}
              >
                Task Title *
              </label>
              <input
                className="form-input"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="What needs to be done?"
                autoFocus
                style={{ width: "100%" }}
              />
            </div>
            <div
              className="form-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                className="form-group"
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  className="form-label"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Project
                </label>
                <select
                  className="form-input"
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                >
                  {projects.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className="form-group"
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  className="form-label"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Add to
                </label>
                <select
                  className="form-input"
                  name="target"
                  value={formData.target}
                  onChange={handleChange}
                >
                  <option value="today">Today</option>
                  <option value="backlog">Backlog</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
            </div>
            <div
              className="form-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                className="form-group"
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  className="form-label"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Due Date
                </label>
                <input
                  className="form-input"
                  name="due"
                  type="date"
                  value={formData.due}
                  onChange={handleChange}
                  style={{ width: "100%" }}
                />
              </div>
              <div
                className="form-group"
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <label
                  className="form-label"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--gh-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Estimate
                </label>
                <input
                  className="form-input"
                  name="est"
                  value={formData.est}
                  onChange={handleChange}
                  placeholder="e.g. 2h, 30m"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div
              className="form-group"
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                className="form-label"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--gh-muted)",
                  textTransform: "uppercase",
                }}
              >
                Notes
              </label>
              <textarea
                className="form-input"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Optional notes…"
                style={{
                  minHeight: "60px",
                  resize: "vertical",
                  width: "100%",
                }}
              />
            </div>
          </div>
          <div
            className="modal-footer"
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--gh-border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
