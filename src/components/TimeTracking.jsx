import { useState, useEffect, useMemo } from 'react';

const fmtSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
};

const fmtDuration = (ms) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
};

const todayISO = () => new Date().toISOString().split('T')[0];

export default function TimeTracking({ tasks, isSleeping, sleepStartTime, settings }) {
  const [currentSleepDuration, setCurrentSleepDuration] = useState("");

  useEffect(() => {
    if (!isSleeping || !sleepStartTime) {
      setCurrentSleepDuration("");
      return;
    }
    const update = () => {
      setCurrentSleepDuration(fmtDuration(Date.now() - sleepStartTime));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isSleeping, sleepStartTime]);

  const today = todayISO();

  const todayEntries = useMemo(() => {
    const entries = [];
    tasks.forEach(task => {
      (task.sessions || []).forEach(sess => {
        const date = new Date(sess.start).toISOString().split('T')[0];
        if (date !== today) return;
        entries.push({
          taskId: task.id,
          taskTitle: task.title,
          project: task.project,
          duration: (sess.end - sess.start) / 1000,
          start: sess.start,
          end: sess.end
        });
      });
    });
    return entries.sort((a, b) => b.start - a.start);
  }, [tasks, today]);

  return (
    <div className="view-timetracking" style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'var(--gh-bg)' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>Time Tracking Record</h2>

      {isSleeping && sleepStartTime && (
        <div style={{
          marginBottom: '24px',
          padding: '16px 20px',
          background: 'rgba(88, 166, 255, 0.05)',
          border: '1px solid var(--gh-blue)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gh-blue)', marginBottom: '4px' }}>
            Sleep Today
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--gh-text)' }}>
            {currentSleepDuration}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--gh-muted)', marginTop: '2px' }}>
            Started at {new Date(sleepStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      <div className="nav-label" style={{ marginBottom: '12px', borderBottom: '1px solid var(--gh-border)', paddingBottom: '8px' }}>
        {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </div>

      {todayEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--gh-muted)' }}>
          No time tracked today.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {todayEntries.map((entry, i) => (
            <div key={i} style={{
              background: 'var(--gh-surface)',
              border: '1px solid var(--gh-border)',
              borderRadius: '6px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: '500', fontSize: '13px' }}>{entry.taskTitle}</div>
                <div style={{ fontSize: '11px', color: 'var(--gh-muted)', fontFamily: 'var(--mono)' }}>
                  {entry.project} · {new Date(entry.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(entry.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: '600', color: 'var(--gh-blue)' }}>
                {fmtSeconds(entry.duration)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
