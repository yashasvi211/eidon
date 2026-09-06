import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TaskOptionsModal({
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onToggleMute,
  isMuted = false,
}) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2500,
          backdropFilter: "blur(2px)",
        }}
        onClick={onClose}
      >
        <motion.div
          className="modal"
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: "var(--gh-surface)",
            border: "1px solid var(--gh-border)",
            borderRadius: "16px",
            width: "380px",
            maxWidth: "92vw",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 30px -10px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            padding: "16px 20px 20px 20px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top handle */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "4px",
                borderRadius: "2px",
                background: "var(--gh-border2)",
              }}
            />
          </div>

          <div
            style={{
              fontSize: "11px",
              fontWeight: "600",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--gh-muted)",
              marginBottom: "14px",
            }}
          >
            Task Options
          </div>

          {/* Option Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Update Card */}
            <div
              onClick={() => {
                onClose();
                onUpdate?.();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: "12px",
                border: "1px solid var(--gh-border)",
                background: "var(--gh-bg)",
                padding: "12px 14px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--gh-blue)";
                e.currentTarget.style.background = "var(--gh-surface2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--gh-border)";
                e.currentTarget.style.background = "var(--gh-bg)";
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "rgba(88, 166, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "14px",
                  flexShrink: 0,
                  color: "var(--gh-blue)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--gh-text)",
                    marginBottom: "2px",
                  }}
                >
                  Update Task
                </div>
                <div style={{ fontSize: "12px", color: "var(--gh-muted)" }}>
                  Edit task details
                </div>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--gh-muted)", flexShrink: 0 }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>

            {/* Mute / Unmute Card */}
            <div
              onClick={() => {
                onClose();
                onToggleMute?.();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: "12px",
                border: isMuted
                  ? "1px solid rgba(88, 166, 255, 0.35)"
                  : "1px solid var(--gh-border)",
                background: isMuted
                  ? "rgba(88, 166, 255, 0.08)"
                  : "var(--gh-bg)",
                padding: "12px 14px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--gh-blue)";
                if (!isMuted) e.currentTarget.style.background = "var(--gh-surface2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isMuted
                  ? "rgba(88, 166, 255, 0.35)"
                  : "var(--gh-border)";
                e.currentTarget.style.background = isMuted
                  ? "rgba(88, 166, 255, 0.08)"
                  : "var(--gh-bg)";
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: isMuted
                    ? "rgba(88, 166, 255, 0.2)"
                    : "rgba(139, 148, 158, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "14px",
                  flexShrink: 0,
                  color: isMuted ? "var(--gh-blue)" : "var(--gh-muted)",
                }}
              >
                {isMuted ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
                    <path d="M18 8a6 6 0 0 0-9.33-5" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: isMuted ? "var(--gh-blue)" : "var(--gh-text)",
                    marginBottom: "2px",
                  }}
                >
                  {isMuted ? "Unmute Task" : "Mute Task"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--gh-muted)" }}>
                  {isMuted
                    ? "Re-enable notifications"
                    : "Silence all notifications"}
                </div>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--gh-muted)", flexShrink: 0 }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>

            {/* Delete Card */}
            <div
              onClick={() => {
                onClose();
                onDelete?.();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: "12px",
                border: "1px solid rgba(248, 81, 73, 0.25)",
                background: "rgba(248, 81, 73, 0.05)",
                padding: "12px 14px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--gh-red)";
                e.currentTarget.style.background = "rgba(248, 81, 73, 0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(248, 81, 73, 0.25)";
                e.currentTarget.style.background = "rgba(248, 81, 73, 0.05)";
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "rgba(248, 81, 73, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "14px",
                  flexShrink: 0,
                  color: "var(--gh-red)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--gh-red)",
                    marginBottom: "2px",
                  }}
                >
                  Delete Task
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "rgba(248, 81, 73, 0.7)",
                  }}
                >
                  Move to trash
                </div>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "rgba(248, 81, 73, 0.5)", flexShrink: 0 }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: "14px",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid var(--gh-border)",
              background: "var(--gh-surface2)",
              color: "var(--gh-muted)",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--gh-text)";
              e.currentTarget.style.borderColor = "var(--gh-border2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--gh-muted)";
              e.currentTarget.style.borderColor = "var(--gh-border)";
            }}
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
