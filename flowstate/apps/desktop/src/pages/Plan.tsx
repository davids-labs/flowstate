import { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar, Upload, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseReady, useDatabase } from '../components/useDatabase';
import * as queries from '@flowstate/core';

interface DayRow {
  id: string;
  date: string;
  title: string;
  dayNumber?: number;
  totalDays?: number;
  mustDoCount: number;
  mustDoDoneCount: number;
  status: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PlanPage() {
  const navigate = useNavigate();
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [days, setDays] = useState<DayRow[]>([]);
  const [planName, setPlanName] = useState<string | null>(null);
  const [totalDays, setTotalDays] = useState(0);
  const [completedDays, setCompletedDays] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  

  const loadData = useCallback(async () => {
    if (!db) return;
    try {
      const plan = await queries.getActivePlan(db);
      if (plan) {
        setPlanName(plan.name);
        const dbDays = await queries.getDayPlansInRange(db, plan.startDate, plan.endDate);
        interface DBDay {
          id: string;
          date: string;
          title: string;
          dayNumber?: number;
          totalDays?: number;
          mustDo?: string[] | string;
          mustDoDone?: boolean[] | string;
          status: string;
        }
        const mapped: DayRow[] = ((dbDays as unknown) as DBDay[]).map((d) => {
          const mustDo = typeof d.mustDo === 'string' ? JSON.parse(d.mustDo) : (d.mustDo ?? []);
          const mustDoDone = typeof d.mustDoDone === 'string' ? JSON.parse(d.mustDoDone) : (d.mustDoDone ?? []);
          return {
            id: d.id,
            date: d.date,
            title: d.title,
            dayNumber: d.dayNumber,
            totalDays: d.totalDays,
            mustDoCount: mustDo.length,
            mustDoDoneCount: mustDoDone.filter(Boolean).length,
            status: d.status,
          };
        });
        setDays(mapped);
        setTotalDays(mapped.length);
        setCompletedDays(mapped.filter((d) => d.status === 'completed').length);
      }
    } catch (err) {
      console.error('Failed to load plan:', err);
    }
  }, [db]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    try {
      const text = await file.text();
      const { parseCSV, validateCSVForImport } = await import('@flowstate/core');
      const result = parseCSV(text);

      // Validate before importing
      const errors = validateCSVForImport(result.rows);
      if (errors.length > 0) {
        const msgs = errors.slice(0, 5).map((e) => `Row ${e.row}: ${e.message}`).join('\n');
        alert(`CSV validation errors:\n${msgs}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''}`);
        return;
      }

      await queries.importPlan(db, { planName: file.name.replace('.csv', ''), sourceFile: file.name, rows: result.rows });
      await loadData();
    } catch (err) {
      console.error('CSV import failed:', err);
      alert('Failed to import CSV. Check format.');
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const progressPct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  if (!ready) {
    return <div className="empty-state"><h3>Loading...</h3></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Plan</h1>
          <p className="page-subtitle">
            {planName ?? 'No active plan'}
            {totalDays > 0 ? ` · ${totalDays} days` : ''}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Import CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {/* Progress bar */}
      {totalDays > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Plan Progress</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{progressPct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {completedDays} completed · {totalDays - completedDays} remaining
          </div>
        </div>
      )}

      {/* Day list */}
      {days.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {days.map((day, idx) => {
            const dateObj = new Date(day.date + 'T12:00:00');
            const dayName = DAY_NAMES[dateObj.getDay()];
            const dayNum = dateObj.getDate();
            const isToday = day.date === todayStr;

            return (
              <div
                key={day.id}
                className="day-row"
                style={{
                  borderBottom: idx < days.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isToday ? 'var(--accent-light)' : undefined,
                }}
                onClick={() => navigate(`/day/${day.date}`)}
              >
                <div className="day-date">
                  <div className="day-date-label">{dayName}</div>
                  <div className="day-date-num">{dayNum}</div>
                </div>
                <div className="day-info">
                  <div className="day-title">{day.title}</div>
                  <div className="day-meta">
                    {day.mustDoDoneCount}/{day.mustDoCount} must-dos
                    {day.dayNumber ? ` · Day ${day.dayNumber}` : ''}
                    {day.totalDays ? ` of ${day.totalDays}` : ''}
                  </div>
                </div>
                {day.status === 'completed' && (
                  <span className="session-status status-completed" style={{ fontSize: 11, padding: '2px 8px' }}>Done</span>
                )}
                <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>No plan loaded</h3>
          <p>Import a CSV file to populate your training plan.</p>
        </div>
      )}
    </div>
  );
}
