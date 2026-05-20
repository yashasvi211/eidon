import React from 'react';

export default function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--gh-bg)',
        color: 'var(--gh-text)',
        position: 'fixed',
        zIndex: 1000,
        top: 0,
        left: 0,
      }}
    >
      {/* Logo icon - diamond stack like Obsidian */}
      <div className="obs-logo" style={{ marginBottom: '28px' }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M22 4 L36 14 L22 24 L8 14 Z" stroke="var(--gh-blue)" strokeWidth="1.6" fill="none" />
          <path d="M22 14 L36 24 L22 34 L8 24 Z" stroke="var(--gh-blue)" strokeWidth="1.6" fill="none" opacity="0.4" />
          <path d="M22 24 L36 34 L22 44 L8 34 Z" stroke="var(--gh-blue)" strokeWidth="1.6" fill="none" />
        </svg>
      </div>

      {/* App name */}
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '0.2em',
          marginBottom: '28px',
          color: 'var(--gh-text)',
        }}
      >
        EIDON
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100px',
          height: '2px',
          background: 'var(--gh-border)',
          borderRadius: '1px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <div className="obs-bar" />
      </div>

      {/* Loading text with dots */}
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          color: 'var(--gh-muted)',
          letterSpacing: '0.15em',
          display: 'flex',
          gap: '2px',
        }}
      >
        <span>LOADING</span>
        <span className="obs-dot" style={{ animationDelay: '0s' }}>.</span>
        <span className="obs-dot" style={{ animationDelay: '0.2s' }}>.</span>
        <span className="obs-dot" style={{ animationDelay: '0.4s' }}>.</span>
      </div>

      <style>{`
        .obs-logo svg {
          animation: obsPulse 2s ease-in-out infinite;
        }
        .obs-bar {
          height: 100%;
          width: 100%;
          background: var(--gh-blue);
          animation: obsProgress 1.5s ease-in-out infinite;
          transform-origin: left;
        }
        .obs-dot {
          animation: obsDot 1.5s ease-in-out infinite;
        }
        @keyframes obsPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes obsProgress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.6); }
          100% { transform: scaleX(0); }
        }
        @keyframes obsDot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
