import React, { useState, useEffect } from 'react';

const messages = [
  'Loading workspace...',
  'Initializing modules...',
  'Fetching tasks...',
  'Indexing projects...',
  'Almost ready...',
];

export default function LoadingScreen() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

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

      {/* Status message */}
      <div className="obs-status" key={index}
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          color: 'var(--gh-muted)',
          letterSpacing: '0.08em',
          marginBottom: '20px',
          height: '18px',
        }}
      >
        {messages[index]}
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '120px',
          height: '2px',
          background: 'var(--gh-border)',
          borderRadius: '1px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <div className="obs-bar" />
      </div>

      <style>{`
        .obs-logo svg {
          animation: obsPulse 2s ease-in-out infinite;
        }
        .obs-bar {
          height: 100%;
          width: 100%;
          background: var(--gh-blue);
          animation: obsProgress 2s ease-in-out forwards;
          transform-origin: left;
        }
        .obs-status {
          animation: obsFade 2s ease-in-out;
        }
        @keyframes obsPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes obsProgress {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes obsFade {
          0% { opacity: 0; transform: translateY(4px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
