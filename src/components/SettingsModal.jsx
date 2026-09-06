import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  getDropboxAuthUrl,
  exchangeDropboxCode,
  testDropboxConnection,
  uploadToDropbox,
  syncFromDropbox,
  exportDataAsJsonFile,
  importDataFromJsonFile,
} from "../services/dropboxService";

const CURATED_COLORS = [
  "#58a6ff", "#3fb950", "#bc8cff", "#ff7b72",
  "#e3b341", "#db61a2", "#f2cc60", "#8b949e",
  "#79c0ff", "#56d364", "#d2a8ff", "#ffa657",
  "#f0883e", "#a371f7", "#39d353", "#1f6feb",
  "#238636", "#8957e5", "#da3633", "#176534",
];

const fmtDate = (ts) => {
  if (!ts) return "Never";
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function SettingsModal({
  isOpen,
  onClose,
  projects = [],
  setProjects,
  settings,
  setSettings,
  tasks = [],
  setTasks,
  onDeleteProject,
  onUpdateProject,
}) {
  // New Project Form state
  const [modalNewProjectName, setModalNewProjectName] = useState("");
  const [modalNewProjectColor, setModalNewProjectColor] = useState("#58a6ff");

  // Editing Project state
  const [editingProjectName, setEditingProjectName] = useState(null);
  const [editProjectInput, setEditProjectInput] = useState("");
  const [editProjectColor, setEditProjectColor] = useState("#58a6ff");

  // Project Delete Confirmation
  const [projectToDelete, setProjectToDelete] = useState(null);

  // Dropbox UI state
  const [authCode, setAuthCode] = useState("");
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // File import ref
  const fileInputRef = useRef(null);

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  // ── Project Handlers ────────────────────────────────────────────────────────
  const handleAddProject = () => {
    if (!modalNewProjectName.trim()) return;
    const trimmed = modalNewProjectName.trim();
    if (projects.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("A project with this name already exists.");
      return;
    }
    const newProj = { name: trimmed, color: modalNewProjectColor };
    setProjects([...projects, newProj]);
    setModalNewProjectName("");
  };

  const handleStartEditProject = (proj) => {
    setEditingProjectName(proj.name);
    setEditProjectInput(proj.name);
    setEditProjectColor(proj.color || "#58a6ff");
  };

  const handleSaveEditProject = () => {
    if (!editingProjectName || !editProjectInput.trim()) return;
    const newName = editProjectInput.trim();
    const oldName = editingProjectName;

    if (onUpdateProject) {
      onUpdateProject(oldName, newName, editProjectColor);
    } else {
      setProjects(
        projects.map((p) =>
          p.name === oldName ? { ...p, name: newName, color: editProjectColor } : p
        )
      );
      if (setTasks && tasks.length > 0 && oldName !== newName) {
        setTasks(
          tasks.map((t) => (t.project === oldName ? { ...t, project: newName } : t))
        );
      }
    }
    setEditingProjectName(null);
  };

  const handleConfirmDeleteProject = (name) => {
    if (onDeleteProject) {
      onDeleteProject(name);
    } else {
      setProjects(projects.filter((p) => p.name !== name));
      if (setTasks) {
        setTasks(tasks.map((t) => (t.project === name ? { ...t, project: "Inbox" } : t)));
      }
    }
    setProjectToDelete(null);
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

  // ── Dropbox Handlers ────────────────────────────────────────────────────────
  const handleGetAuthCode = () => {
    window.open(getDropboxAuthUrl(), "_blank", "noopener,noreferrer");
  };

  const handleExchangeCode = async () => {
    if (!authCode.trim()) {
      setConnectionStatus("Please paste the authorization code from Dropbox.");
      return;
    }
    setConnectionLoading(true);
    setConnectionStatus("Connecting to Dropbox...");
    try {
      const result = await exchangeDropboxCode(authCode);
      setSettings((prev) => ({
        ...prev,
        dropboxToken: result.accessToken,
        dropboxRefreshToken: result.refreshToken,
        tokenExpiresAt: result.tokenExpiresAt,
      }));
      setAuthCode("");
      setConnectionStatus("Connected to Dropbox successfully!");
    } catch (err) {
      setConnectionStatus(`Connection failed: ${err.message}`);
    } finally {
      setConnectionLoading(false);
    }
  };

  const handleDisconnectDropbox = () => {
    setSettings((prev) => ({
      ...prev,
      dropboxToken: "",
      dropboxRefreshToken: "",
      tokenExpiresAt: 0,
      autoSyncEnabled: false,
    }));
    setConnectionStatus(null);
    setSyncStatus(null);
  };

  const handleTestConnection = async () => {
    if (!settings.dropboxToken) return;
    setConnectionLoading(true);
    setConnectionStatus(null);
    const result = await testDropboxConnection(settings.dropboxToken);
    setConnectionStatus(result.message);
    setConnectionLoading(false);
  };

  const handleUploadToDropbox = async () => {
    if (!settings.dropboxToken) return;
    setSyncLoading(true);
    setSyncStatus(null);
    const result = await uploadToDropbox(
      settings.dropboxToken,
      { tasks, projects, settings },
      settings.dropboxPath || "/eidon"
    );
    setSyncStatus(result.message);
    if (result.success) {
      setSettings((prev) => ({ ...prev, lastSyncTime: Date.now() }));
    }
    setSyncLoading(false);
  };

  const handleSyncFromDropbox = async () => {
    if (!settings.dropboxToken) return;
    setSyncLoading(true);
    setSyncStatus(null);
    const result = await syncFromDropbox(
      settings.dropboxToken,
      settings.dropboxPath || "/eidon"
    );
    setSyncStatus(result.message);
    if (result.success && result.data) {
      if (Array.isArray(result.data.projects) && result.data.projects.length > 0) {
        setProjects(result.data.projects);
      }
      if (Array.isArray(result.data.tasks) && setTasks) {
        setTasks(result.data.tasks);
      }
      setSettings((prev) => ({ ...prev, lastSyncTime: Date.now() }));
    }
    setSyncLoading(false);
  };

  // ── Import / Export Handlers ────────────────────────────────────────────────
  const handleExportJson = () => {
    exportDataAsJsonFile({ tasks, projects, settings });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importDataFromJsonFile(file);
      if (Array.isArray(data.projects) && data.projects.length > 0) {
        setProjects(data.projects);
      }
      if (Array.isArray(data.tasks) && setTasks) {
        setTasks(data.tasks);
      }
      alert("Data imported successfully!");
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        backdropFilter: "blur(2px)",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.94, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 15, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "var(--gh-surface)",
          border: "1px solid var(--gh-border)",
          borderRadius: "14px",
          width: "560px",
          maxWidth: "100%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 35px -10px rgba(0, 0, 0, 0.6)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--gh-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>⚙️</span>
            <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--gh-text)", margin: 0 }}>
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--gh-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gh-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--gh-muted)")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* 1. PREFERENCES */}
          <section>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Preferences
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: "var(--gh-surface2)",
                border: "1px solid var(--gh-border)",
                borderRadius: "8px",
                marginBottom: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--gh-text)", marginBottom: "2px" }}>
                  Show Completed Tasks
                </div>
                <div style={{ fontSize: "11px", color: "var(--gh-muted)" }}>
                  Toggle whether completed tasks are displayed in your lists.
                </div>
              </div>
              <div
                onClick={() =>
                  setSettings((prev) => ({ ...prev, showCompleted: prev.showCompleted !== false ? false : true }))
                }
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "12px",
                  background: settings.showCompleted !== false ? "var(--gh-blue)" : "var(--gh-border2)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: "3px",
                    left: settings.showCompleted !== false ? "23px" : "3px",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </div>
            </div>

            {/* Application Size */}
            <div
              style={{
                padding: "12px 14px",
                background: "var(--gh-surface2)",
                border: "1px solid var(--gh-border)",
                borderRadius: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--gh-text)" }}>
                  Application Size ({settings.appSize || 100}%)
                </span>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, appSize: 100 }))}
                  style={{ background: "none", border: "none", color: "var(--gh-blue)", fontSize: "11px", cursor: "pointer" }}
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
                  value={settings.appSize || 100}
                  onChange={(e) => setSettings((prev) => ({ ...prev, appSize: parseInt(e.target.value, 10) }))}
                  style={{ flex: 1, accentColor: "var(--gh-blue)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--gh-muted)", width: "36px", textAlign: "right" }}>
                  {settings.appSize || 100}%
                </span>
              </div>
            </div>
          </section>

          {/* 2. SLEEP SCHEDULE */}
          <section>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Sleep Schedule
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ padding: "12px 14px", background: "var(--gh-surface2)", border: "1px solid var(--gh-border)", borderRadius: "8px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--gh-muted)", marginBottom: "6px" }}>
                  Sleep Start
                </label>
                <input
                  type="time"
                  value={settings.sleepStart || "22:00"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, sleepStart: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "var(--gh-bg)",
                    border: "1px solid var(--gh-border)",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: "var(--gh-text)",
                    fontSize: "13px",
                    fontFamily: "var(--mono)",
                  }}
                />
              </div>
              <div style={{ padding: "12px 14px", background: "var(--gh-surface2)", border: "1px solid var(--gh-border)", borderRadius: "8px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "var(--gh-muted)", marginBottom: "6px" }}>
                  Wake Up
                </label>
                <input
                  type="time"
                  value={settings.sleepEnd || "07:00"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, sleepEnd: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "var(--gh-bg)",
                    border: "1px solid var(--gh-border)",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: "var(--gh-text)",
                    fontSize: "13px",
                    fontFamily: "var(--mono)",
                  }}
                />
              </div>
            </div>
          </section>

          {/* 3. EXPORT / IMPORT */}
          <section>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
              Export / Import
            </div>
            <div style={{ fontSize: "12px", color: "var(--gh-muted)", marginBottom: "12px" }}>
              Export your data as a JSON file or import from a previously exported file.
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="btn"
                onClick={handleExportJson}
                style={{ flex: 1, justifyContent: "center", padding: "8px 12px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Export JSON
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, justifyContent: "center", padding: "8px 12px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Import JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>
          </section>

          {/* 4. DROPBOX SYNC */}
          <section>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
              Dropbox Sync
            </div>
            <div style={{ fontSize: "12px", color: "var(--gh-muted)", marginBottom: "12px" }}>
              Backup and restore your data via Dropbox cloud storage.
            </div>

            <div
              style={{
                padding: "16px",
                background: "var(--gh-surface2)",
                border: "1px solid var(--gh-border)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--gh-text)" }}>
                    Dropbox Connection
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--gh-muted)" }}>
                    {settings.dropboxToken ? "Account connected and ready to sync" : "Link your Dropbox account"}
                  </div>
                </div>
                {settings.dropboxToken ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--gh-green)",
                      fontSize: "12px",
                      fontWeight: "600",
                      background: "rgba(63, 185, 80, 0.1)",
                      border: "1px solid rgba(63, 185, 80, 0.3)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    ✓ Connected
                  </span>
                ) : (
                  <span
                    style={{
                      color: "var(--gh-muted)",
                      fontSize: "12px",
                      background: "var(--gh-bg)",
                      border: "1px solid var(--gh-border)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    Not connected
                  </span>
                )}
              </div>

              {settings.dropboxToken ? (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleTestConnection}
                    disabled={connectionLoading}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {connectionLoading ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleDisconnectDropbox}
                    style={{ color: "var(--gh-red)", borderColor: "rgba(248, 81, 73, 0.3)" }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleGetAuthCode}
                    style={{ justifyContent: "center", padding: "8px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Step 1: Get Auth Code (Opens Dropbox)
                  </button>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      className="add-task-input"
                      placeholder="Step 2: Paste Auth Code Here"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      style={{ flex: 1, fontSize: "12px", fontFamily: "var(--mono)" }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleExchangeCode}
                      disabled={connectionLoading || !authCode.trim()}
                      style={{ padding: "8px 16px" }}
                    >
                      {connectionLoading ? "Connecting..." : "Step 3: Connect"}
                    </button>
                  </div>
                </div>
              )}

              {connectionStatus && (
                <div
                  style={{
                    fontSize: "12px",
                    color: connectionStatus.includes("Connected") ? "var(--gh-green)" : "var(--gh-red)",
                    background: connectionStatus.includes("Connected")
                      ? "rgba(63, 185, 80, 0.08)"
                      : "rgba(248, 81, 73, 0.08)",
                    border: `1px solid ${
                      connectionStatus.includes("Connected")
                        ? "rgba(63, 185, 80, 0.25)"
                        : "rgba(248, 81, 73, 0.25)"
                    }`,
                    padding: "8px 10px",
                    borderRadius: "6px",
                  }}
                >
                  {connectionStatus}
                </div>
              )}

              {/* Sync Actions */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUploadToDropbox}
                  disabled={syncLoading || !settings.dropboxToken}
                  style={{ flex: 1, justifyContent: "center", padding: "9px 12px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {syncLoading ? "Uploading..." : "Upload to Dropbox"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleSyncFromDropbox}
                  disabled={syncLoading || !settings.dropboxToken}
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    padding: "9px 12px",
                    borderColor: "var(--gh-green)",
                    color: "var(--gh-green)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {syncLoading ? "Downloading..." : "Sync from Dropbox"}
                </button>
              </div>

              {/* Auto Sync Toggle */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--gh-border)",
                  paddingTop: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--gh-text)" }}>
                    Auto-sync
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--gh-muted)" }}>
                    Automatically upload changes at scheduled intervals.
                  </div>
                </div>
                <div
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, autoSyncEnabled: !prev.autoSyncEnabled }))
                  }
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "12px",
                    background: settings.autoSyncEnabled ? "var(--gh-blue)" : "var(--gh-border2)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: "3px",
                      left: settings.autoSyncEnabled ? "23px" : "3px",
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
              </div>

              {syncStatus && (
                <div
                  style={{
                    fontSize: "12px",
                    color: syncStatus.includes("failed") || syncStatus.includes("error")
                      ? "var(--gh-red)"
                      : "var(--gh-green)",
                    padding: "6px 8px",
                    background: "var(--gh-surface)",
                    borderRadius: "6px",
                    border: "1px solid var(--gh-border)",
                  }}
                >
                  {syncStatus}
                </div>
              )}

              <div style={{ fontSize: "11px", color: "var(--gh-muted)", fontFamily: "var(--mono)" }}>
                Last sync: {fmtDate(settings.lastSyncTime)}
              </div>
            </div>
          </section>

          {/* 5. ADD PROJECT */}
          <section>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Add Project
            </div>
            <div
              style={{
                padding: "14px",
                background: "var(--gh-surface2)",
                border: "1px solid var(--gh-border)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {CURATED_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setModalNewProjectColor(c)}
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: c,
                      cursor: "pointer",
                      border: modalNewProjectColor === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
                      boxShadow: modalNewProjectColor === c ? "0 0 0 1px var(--gh-blue)" : "none",
                      transform: modalNewProjectColor === c ? "scale(1.15)" : "scale(1)",
                      transition: "all 0.15s ease",
                    }}
                    title={c}
                  />
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: modalNewProjectColor,
                    flexShrink: 0,
                  }}
                />
                <input
                  type="text"
                  className="add-task-input"
                  placeholder="New project name..."
                  value={modalNewProjectName}
                  onChange={(e) => setModalNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddProject}
                  style={{ padding: "6px 14px" }}
                >
                  Add Project
                </button>
              </div>
            </div>
          </section>

          {/* 6. MANAGE PROJECTS */}
          <section>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--gh-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Manage Projects ({projects.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {projects.map((proj, index) => {
                const isEditing = editingProjectName === proj.name;

                if (isEditing) {
                  return (
                    <div
                      key={`edit_${proj.name}`}
                      style={{
                        padding: "12px",
                        background: "var(--gh-surface2)",
                        border: "1px solid var(--gh-blue)",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {CURATED_COLORS.map((c) => (
                          <div
                            key={c}
                            onClick={() => setEditProjectColor(c)}
                            style={{
                              width: "16px",
                              height: "16px",
                              borderRadius: "50%",
                              background: c,
                              cursor: "pointer",
                              border: editProjectColor === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
                              boxShadow: editProjectColor === c ? "0 0 0 1px var(--gh-blue)" : "none",
                              transform: editProjectColor === c ? "scale(1.15)" : "scale(1)",
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          className="add-task-input"
                          value={editProjectInput}
                          onChange={(e) => setEditProjectInput(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setEditingProjectName(null)}
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleSaveEditProject}
                          style={{ padding: "4px 12px", fontSize: "12px" }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={proj.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--gh-surface2)",
                      border: "1px solid var(--gh-border)",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--gh-muted)", width: "16px" }}>
                        {index + 1}.
                      </span>
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: proj.color || "#58a6ff",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "13px", color: "var(--gh-text)", fontWeight: "500" }}>
                        {proj.name}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        onClick={() => moveProject(index, -1)}
                        disabled={index === 0}
                        style={{
                          background: "none",
                          border: "1px solid var(--gh-border2)",
                          color: "var(--gh-muted)",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          opacity: index === 0 ? 0.3 : 1,
                          fontSize: "11px",
                        }}
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProject(index, 1)}
                        disabled={index === projects.length - 1}
                        style={{
                          background: "none",
                          border: "1px solid var(--gh-border2)",
                          color: "var(--gh-muted)",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          cursor: index === projects.length - 1 ? "not-allowed" : "pointer",
                          opacity: index === projects.length - 1 ? 0.3 : 1,
                          fontSize: "11px",
                        }}
                        title="Move Down"
                      >
                        ↓
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEditProject(proj)}
                        style={{
                          background: "none",
                          border: "1px solid var(--gh-border)",
                          color: "var(--gh-muted)",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                        title="Edit Project"
                      >
                        Edit
                      </button>

                      {/* Delete Button */}
                      {proj.name !== "Inbox" && (
                        <button
                          type="button"
                          onClick={() => setProjectToDelete(proj.name)}
                          style={{
                            background: "none",
                            border: "1px solid rgba(248, 81, 73, 0.3)",
                            color: "var(--gh-red)",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                          title="Delete Project"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--gh-border)",
            display: "flex",
            justifyContent: "flex-end",
            background: "var(--gh-surface2)",
          }}
        >
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </motion.div>

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
          }}
          onClick={() => setProjectToDelete(null)}
        >
          <div
            style={{
              background: "var(--gh-surface)",
              border: "1px solid var(--gh-border)",
              borderRadius: "12px",
              padding: "20px",
              width: "380px",
              maxWidth: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--gh-text)", marginBottom: "8px" }}>
              Delete Project
            </div>
            <div style={{ fontSize: "13px", color: "var(--gh-muted)", marginBottom: "16px", lineHeight: "1.5" }}>
              Are you sure you want to delete <strong>{projectToDelete}</strong>? Tasks belonging to this project will be moved to <strong>Inbox</strong>.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setProjectToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleConfirmDeleteProject(projectToDelete)}
                style={{ background: "rgba(248, 81, 73, 0.15)", color: "var(--gh-red)" }}
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
