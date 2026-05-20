import React, { useState, useMemo } from 'react';

const fmtDateISO = (d) => {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export default function ScheduledView({ tasks, setSelectedTaskId, setCurrentView }) {
  const [viewDate, setViewDate] = useState(new Date());

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Padding for previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Padding for next month
    const totalDays = 42; // 6 weeks
    const remainingDays = totalDays - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [viewDate]);

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handlePrev = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNext = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const handleToday = () => setViewDate(new Date());

  const getTasksForDate = (date) => {
    const iso = fmtDateISO(date);
    return tasks.filter(t => t.due === iso);
  };

  return (
    <div className="view-scheduled" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--gh-bg)' }}>
      <div className="cal-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--gh-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="btn" onClick={handlePrev}>‹</button>
        <div className="cal-month-label" style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: '600', minWidth: '150px', textAlign: 'center' }}>
          {monthLabel}
        </div>
        <button className="btn" onClick={handleNext}>›</button>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={handleToday}>Today</button>
      </div>

      <div className="cal-grid-container" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div className="cal-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--gh-muted)', textAlign: 'center', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>

        <div className="cal-days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {calendarData.map((day, i) => {
            const dayTasks = getTasksForDate(day.date);
            const isToday = fmtDateISO(day.date) === fmtDateISO(new Date());

            return (
              <div
                key={i}
                style={{
                  minHeight: '100px',
                  background: day.isCurrentMonth ? 'var(--gh-surface)' : 'rgba(22, 27, 34, 0.4)',
                  border: `1px solid ${isToday ? 'var(--gh-blue-dim)' : 'var(--gh-border)'}`,
                  borderRadius: '6px',
                  padding: '6px',
                  opacity: day.isCurrentMonth ? 1 : 0.4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  color: isToday ? 'var(--gh-blue)' : 'var(--gh-muted)',
                  fontWeight: isToday ? '600' : '400'
                }}>
                  {day.date.getDate()}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayTasks.map(t => (
                    <div
                      key={t.id}
                      onClick={() => { setSelectedTaskId(t.id); setCurrentView('today'); }}
                      style={{
                        fontSize: '10px',
                        background: 'var(--gh-surface2)',
                        border: '1px solid var(--gh-border)',
                        borderRadius: '3px',
                        padding: '1px 4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        textDecoration: t.done ? 'line-through' : 'none',
                        color: t.done ? 'var(--gh-muted)' : 'var(--gh-text)'
                      }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
