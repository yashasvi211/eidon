import React, { useMemo } from 'react';

const fmtSeconds = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
};

const parseEstimate = (est) => {
  if (!est) return 0;
  let total = 0;
  const hMatch = est.match(/(\d+\.?\d*)h/);
  const mMatch = est.match(/(\d+)m/);
  if (hMatch) total += parseFloat(hMatch[1]) * 3600;
  if (mMatch) total += parseInt(mMatch[1]) * 60;
  return total;
};

export default function DeepStats({ tasks }) {
  const stats = useMemo(() => {
    let totalAllocated = 0;
    let totalWorked = 0;
    let totalWindows = 0;
    let taskBreakdown = [];

    tasks.forEach(task => {
      const alloc = parseEstimate(task.est);
      const worked = (task.sessions || []).reduce((acc, s) => acc + (s.end - s.start) / 1000, 0);
      const windows = (task.sessions || []).length;

      totalAllocated += alloc;
      totalWorked += worked;
      totalWindows += windows;

      taskBreakdown.push({
        title: task.title,
        worked,
        alloc,
        windows
      });
    });

    return { totalAllocated, totalWorked, totalWindows, taskBreakdown };
  }, [tasks]);

  return (
    <div className="view-stats" style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'var(--gh-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Deep Stats</h2>
      </div>

      <div className="stats-section">
        <div className="nav-label" style={{ marginBottom: '12px' }}>Today's Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <StatCard label="Total Allocated" value={fmtSeconds(stats.totalAllocated)} sub="across all tasks" highlight="var(--gh-amber)" />
          <StatCard label="Total Worked" value={fmtSeconds(stats.totalWorked)} sub="actual time" highlight="var(--gh-green)" />
          <StatCard label="Total Windows" value={stats.totalWindows} sub="start → stop pairs" highlight="var(--gh-blue)" />
          <StatCard label="Unproductive Gaps" value="0" sub="gaps > 5 min" highlight="var(--gh-red)" />
        </div>
      </div>

      <div className="stats-section">
        <div className="nav-label" style={{ marginBottom: '12px' }}>Task Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {stats.taskBreakdown.map((task, i) => (
            <div key={i} style={{ background: 'var(--gh-surface)', border: '1px solid var(--gh-border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: '500' }}>{task.title}</span>
                <span style={{ fontSize: '12px', color: 'var(--gh-muted)', fontFamily: 'var(--mono)' }}>{task.windows} windows</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', marginBottom: '12px', fontFamily: 'var(--mono)' }}>
                <span style={{ color: 'var(--gh-green)' }}>{fmtSeconds(task.worked)} worked</span>
                <span style={{ color: 'var(--gh-amber)' }}>{fmtSeconds(task.alloc)} alloc</span>
              </div>
              <div style={{ height: '4px', background: 'var(--gh-border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${task.alloc > 0 ? Math.min(100, (task.worked / task.alloc) * 100) : 0}%`,
                  background: 'var(--gh-blue)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <div className="nav-label" style={{ marginBottom: '12px' }}>Session Timeline</div>
        <div style={{ background: 'var(--gh-surface)', border: '1px solid var(--gh-border)', borderRadius: '8px', padding: '16px' }}>
          {stats.taskBreakdown.filter(t => t.worked > 0).map((task, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ width: '100px', fontSize: '12px', color: 'var(--gh-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
              <div style={{ flex: 1, height: '12px', background: 'var(--gh-green-dim)', borderRadius: '3px' }} />
              <span style={{ fontSize: '12px', color: 'var(--gh-muted)', fontFamily: 'var(--mono)' }}>{fmtSeconds(task.worked)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }) {
  return (
    <div style={{ background: 'var(--gh-surface)', border: '1px solid var(--gh-border)', borderRadius: '8px', padding: '16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--gh-muted)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '600', color: highlight, marginBottom: '4px', fontFamily: 'var(--mono)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--gh-muted)' }}>{sub}</div>
    </div>
  );
}
