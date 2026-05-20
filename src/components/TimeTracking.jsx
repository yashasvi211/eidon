import React, { useMemo } from 'react';

const fmtSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
};

const fmtDateDisplay = (iso) => {
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(m) - 1] + ' ' + parseInt(d) + ', ' + y;
};

export default function TimeTracking({ tasks }) {
  const logsByDate = useMemo(() => {
    const logs = {};

    tasks.forEach(task => {
      (task.sessions || []).forEach(sess => {
        const date = new Date(sess.start).toISOString().split('T')[0];
        if (!logs[date]) logs[date] = [];
        logs[date].push({
          taskId: task.id,
          taskTitle: task.title,
          project: task.project,
          duration: (sess.end - sess.start) / 1000,
          start: sess.start,
          end: sess.end
        });
      });
    });

    // Sort dates descending
    return Object.keys(logs).sort().reverse().map(date => ({
      date,
      entries: logs[date].sort((a, b) => b.start - a.start)
    }));
  }, [tasks]);

  return (
    <div className="view-timetracking" style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'var(--gh-bg)' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>Time Tracking Record</h2>

      {logsByDate.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--gh-muted)' }}>
          No time tracked yet.
        </div>
      ) : (
        logsByDate.map(day => (
          <div key={day.date} style={{ marginBottom: '32px' }}>
            <div className="nav-label" style={{ marginBottom: '12px', borderBottom: '1px solid var(--gh-border)', paddingBottom: '8px' }}>
              {fmtDateDisplay(day.date)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {day.entries.map((entry, i) => (
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
          </div>
        ))
      )}
    </div>
  );
}
