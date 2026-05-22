import React from "react";
import "../App.css";

export default function SettingsModal({
  isOpen,
  onClose,
  projects,
  setProjects,
  settings,
  setSettings,
}) {
  if (!isOpen) return null;

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
    <div
      className="modal-overlay fade-in"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="modal"
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
              Rearrange Projects
            </label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {projects.map((proj, index) => (
                <div
                  key={proj.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 12px",
                    background: "var(--gh-surface2)",
                    border: "1px solid var(--gh-border)",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: proj.color,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: "13px" }}>{proj.name}</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
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
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveProject(index, 1)}
                      disabled={index === projects.length - 1}
                      style={{
                        background: "none",
                        border: "1px solid var(--gh-border2)",
                        color: "var(--gh-muted)",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        cursor:
                          index === projects.length - 1
                            ? "not-allowed"
                            : "pointer",
                        opacity: index === projects.length - 1 ? 0.3 : 1,
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
      </div>
    </div>
  );
}
