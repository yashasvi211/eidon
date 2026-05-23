import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function StartTimerModal({ isOpen, onClose, onStart }) {
  const [note, setNote] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current.focus(), 100);
    }
    if (isOpen) {
      setNote("");
    }
  }, [isOpen]);

  const handleStart = () => {
    onStart(note.trim());
    setNote("");
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <motion.div
        className="modal timer-note-modal"
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 400 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--gh-surface)",
          border: "1px solid var(--gh-border)",
          borderRadius: "14px",
          padding: "24px",
          width: "420px",
          maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(63,185,80,0.2), rgba(35,134,54,0.15))",
              border: "1px solid rgba(63,185,80,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#3fb950">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--gh-text)" }}>
              Start Timer Session
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--gh-muted)",
                fontFamily: "var(--mono)",
                marginTop: "2px",
              }}
            >
              What are you working on?
            </div>
          </div>
        </div>

        {/* Note textarea */}
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., Fixing the API integration bug, reviewing pull requests..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleStart();
            }
          }}
          style={{
            width: "100%",
            minHeight: "100px",
            background: "var(--gh-surface2)",
            border: "1px solid var(--gh-border)",
            borderRadius: "10px",
            padding: "14px",
            color: "var(--gh-text)",
            fontFamily: "var(--sans)",
            fontSize: "13px",
            lineHeight: "1.6",
            outline: "none",
            resize: "vertical",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        <div
          style={{
            fontSize: "11px",
            color: "var(--gh-muted)",
            fontFamily: "var(--mono)",
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ opacity: 0.7 }}>A note helps you remember what you worked on</span>
          <span>⌘ + Enter to start</span>
        </div>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "20px",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleStart}
            style={{
              background: "var(--gh-green-dim)",
              borderColor: "var(--gh-green-dim)",
              gap: "6px",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Timer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
