import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function EditTaskModal({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
}) {
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [reason, setReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      setDueDate(task.due || "");
      setEstimate(task.est || "");
      setReason("");
      setDeleteConfirm("");
      setHasChanges(false);
    }
  }, [isOpen, task?.id]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (task) {
      const dueDiff = dueDate !== (task.due || "");
      const estDiff = estimate !== (task.est || "");
      setHasChanges(dueDiff || estDiff);
    }
  }, [dueDate, estimate, task]);

  const handleSave = () => {
    if (!hasChanges || !reason.trim()) return;

    const changes = {};
    if (dueDate !== (task.due || "")) {
      changes.due = dueDate;
      changes.oldDue = task.due;
    }
    if (estimate !== (task.est || "")) {
      changes.est = estimate;
      changes.oldEst = task.est;
    }

    onSave(task.id, changes, reason.trim());
    onClose();
  };

  const confirmText = `delete ${task?.title || ""}`.toLowerCase();
  const isDeleteMatch = deleteConfirm.toLowerCase().trim() === confirmText;

  const handleDelete = () => {
    if (!isDeleteMatch) return;
    onDelete(task.id);
    onClose();
  };

  if (!task) return null;

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
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
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
          borderRadius: "14px",
          width: "480px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--gh-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              Edit Task
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--gh-muted)",
                fontFamily: "var(--mono)",
              }}
            >
              {task.title}
            </div>
          </div>
          <div
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--gh-muted)",
              fontSize: "16px",
              transition: "all 0.15s",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--gh-surface2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            ✕
          </div>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            padding: "20px 24px",
            flex: 1,
            overflowY: "auto",
          }}
        >
          {/* Edit Fields Section */}
          <div className="edit-section">
            <div className="edit-section-label">Update Task Details</div>

            <div className="edit-field-row">
              <span className="edit-field-label">Due Date</span>
              <input
                type="date"
                className="edit-field-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ colorScheme: "dark" }}
              />
            </div>

            <div className="edit-field-row">
              <span className="edit-field-label">Time Estimate</span>
              <input
                type="text"
                className="edit-field-input"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="e.g. 4h, 2.5h, 30m"
              />
            </div>

            {hasChanges && (
              <div
                style={{
                  marginTop: "14px",
                  animation: "contentFadeIn 0.3s ease",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--gh-muted)",
                    marginBottom: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ color: "var(--gh-amber)" }}>⚠</span>
                  Reason for change
                  <span style={{ color: "var(--gh-red)" }}>*</span>
                </div>
                <textarea
                  className="reason-textarea"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you making this change? This will be logged in the audit trail..."
                />
              </div>
            )}

            {hasChanges && (
              <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!reason.trim()}
                  style={{
                    opacity: reason.trim() ? 1 : 0.4,
                    cursor: reason.trim() ? "pointer" : "not-allowed",
                    flex: 1,
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Save Changes
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setDueDate(task.due || "");
                    setEstimate(task.est || "");
                    setReason("");
                  }}
                  style={{ justifyContent: "center" }}
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              background: "var(--gh-border)",
              margin: "8px 0 20px",
            }}
          />

          {/* Danger Zone */}
          <div className="danger-zone">
            <div className="danger-zone-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Danger Zone
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "var(--gh-muted)",
                lineHeight: "1.5",
                marginBottom: "12px",
              }}
            >
              This action is <strong style={{ color: "var(--gh-red)" }}>permanent</strong> and
              cannot be undone. To confirm deletion, type{" "}
              <code
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  background: "var(--gh-surface2)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  color: "var(--gh-red)",
                  border: "1px solid rgba(248,81,73,0.2)",
                }}
              >
                delete {task.title.toLowerCase()}
              </code>{" "}
              below.
            </p>
            <input
              type="text"
              className={`confirm-input ${isDeleteMatch ? "matched" : ""}`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={`Type "delete ${task.title.toLowerCase()}" to confirm`}
              style={{ marginBottom: "12px" }}
            />
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={!isDeleteMatch}
              style={{
                width: "100%",
                justifyContent: "center",
                opacity: isDeleteMatch ? 1 : 0.35,
                cursor: isDeleteMatch ? "pointer" : "not-allowed",
                background: isDeleteMatch
                  ? "rgba(248, 81, 73, 0.15)"
                  : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Delete this task permanently
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
