import React, { useEffect } from "react";
import { motion } from "framer-motion";
import "../App.css";

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  type = "danger",
}) {
  // Escape key listener
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

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
          borderRadius: "12px",
          width: "400px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "24px", textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background:
                type === "danger"
                  ? "rgba(248, 81, 73, 0.1)"
                  : "rgba(88, 166, 255, 0.1)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: type === "danger" ? "var(--gh-red)" : "var(--gh-blue)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {type === "danger" ? (
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              ) : (
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
          </div>
          <h3
            style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}
          >
            {title}
          </h3>
          <p
            style={{
              fontSize: "14px",
              color: "var(--gh-muted)",
              lineHeight: "1.5",
            }}
          >
            {message}
          </p>
        </div>
        <div
          style={{
            padding: "16px",
            background: "var(--gh-surface2)",
            display: "flex",
            gap: "12px",
            justifyContent: "center",
          }}
        >
          <button
            className="btn"
            onClick={onClose}
            style={{ minWidth: "100px", justifyContent: "center" }}
          >
            {cancelText}
          </button>
          <button
            className={type === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            style={{
              minWidth: "100px",
              justifyContent: "center",
              background:
                type === "danger" ? "var(--gh-red)" : "var(--gh-blue)",
              color: "#fff",
              border: "none",
            }}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
