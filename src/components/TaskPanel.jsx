import React, { useState } from 'react';
import TaskItem from './TaskItem';

function FilterTag({ active, onClick, label }) {
  return (
    <span className={`section-tag ${active ? 'active' : ''}`} onClick={onClick} style={{
      fontFamily: 'var(--mono)', fontSize: '11px', background: active ? 'rgba(31,111,235,0.1)' : 'var(--gh-surface2)',
      border: `1px solid ${active ? 'var(--gh-blue-dim)' : 'var(--gh-border)'}`, borderRadius: '20px', padding: '2px 10px',
      color: active ? 'var(--gh-blue)' : 'var(--gh-muted)', cursor: 'pointer', transition: 'all 0.15s'
    }}>{label}</span>
  );
}

function QuickAdd({ onAdd }) {
  const [val, setVal] = useState('');
  return (
    <div className="add-task-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--gh-border)', background: 'var(--gh-surface)' }}>
      <input
        className="add-task-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(val); setVal(''); } }}
        placeholder="Quick add task… (Enter to save)"
        style={{ flex: 1, background: 'var(--gh-surface2)', border: '1px solid var(--gh-border)', borderRadius: '6px', padding: '6px 12px', color: 'var(--gh-text)', fontSize: '13px', outline: 'none' }}
      />
      <button className="btn btn-primary" onClick={() => { onAdd(val); setVal(''); }} style={{ padding: '6px 10px' }}>+</button>
    </div>
  );
}

export default function TaskPanel({ tasks, timeLogs, currentFilter, setCurrentFilter, selectedTaskId, setSelectedTaskId, toggleDone, handleQuickAdd, currentView, currentProject }) {
  return (
    <div className="task-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--gh-border)' }}>
      <div className="task-panel-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--gh-border)', display: 'flex', gap: '10px' }}>
        <FilterTag active={currentFilter === 'all'} onClick={() => setCurrentFilter('all')} label="All" />
        <FilterTag active={currentFilter === 'active'} onClick={() => setCurrentFilter('active')} label="Active" />
        <FilterTag active={currentFilter === 'done'} onClick={() => setCurrentFilter('done')} label="Done" />
      </div>
      <QuickAdd onAdd={handleQuickAdd} />
      <div className="task-list" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {tasks.filter(t => t.target === (currentView === 'backlog' ? 'backlog' : 'today'))
          .filter(t => currentFilter === 'all' ? true : currentFilter === 'active' ? !t.done : t.done)
          .filter(t => !currentProject || t.project === currentProject)
          .map(task => (
            <TaskItem
              key={task.id}
              task={task}
              active={selectedTaskId === task.id}
              onSelect={() => setSelectedTaskId(task.id)}
              onToggle={() => toggleDone(task.id)}
              loggedTime={timeLogs.filter(l => l.taskId === task.id).reduce((a, l) => a + l.seconds, 0)}
            />
          ))}
      </div>
    </div>
  );
}
