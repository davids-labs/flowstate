import { useEffect, useState, useCallback } from 'react';
import { CheckSquare, Clock, PlayCircle, Square, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseReady, useDatabase } from '../components/useDatabase';
import { useDayStore } from '../stores/dayStore';
import * as queries from '@flowstate/core';

interface SessionRow {
  id: string;
  routineName: string;
  status: string;
  duration: number;
}

interface ModuleSpec {
  id: string;
  label: string;
  emoji?: string | null;
  type: string;
}

export function TodayPage() {
  const navigate = useNavigate();
  const db = useDatabase();
  const ready = useDatabaseReady();
  const dayPlan = useDayStore((s) => s.dayPlan);
  const loadDay = useDayStore((s) => s.loadDay);
  const toggleMustDo = useDayStore((s) => s.toggleMustDo);
  const moduleValues = useDayStore((s) => s.moduleValues);
  const setModuleValue = useDayStore((s) => s.setModuleValue);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [moduleSpecs, setModuleSpecs] = useState<ModuleSpec[]>([]);

  

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async () => {
    if (!db) return;
    await loadDay(db, todayStr);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const specs = (await queries.getModuleSpecs(db as any)) as ModuleSpec[];
    setModuleSpecs(specs);
  }, [db, todayStr, loadDay]);

  useEffect(() => {
    const t = setTimeout(() => { void loadData(); }, 0);
    return () => clearTimeout(t);
  }, [loadData]);

  // Load sessions
  useEffect(() => {
    if (!db || !dayPlan) return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ss = (await queries.getSessions(db as any, dayPlan.id)) as any[];
        setSessions(ss.map((s) => ({ id: s.id, routineName: s.routineName, status: s.status, duration: 0 })));
      } catch {
        // ignore
      }
    })();
  }, [db, dayPlan]);

  if (!ready || !db) {
    return <div className="empty-state"><h3>Loading...</h3></div>;
  }

  const mustDoCompleted = dayPlan?.mustDoDone.filter(Boolean).length ?? 0;

  // Day modules (from moduleIds on dayPlan)
  const dayModuleSpecs = dayPlan?.moduleIds
    ? moduleSpecs.filter((m) => (dayPlan.moduleIds ?? []).includes(m.id))
    : [];

  return (
    <div>
      <h1 className="page-title">Today</h1>
      <p className="page-subtitle">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        {dayPlan?.dayNumber ? ` · Day ${dayPlan.dayNumber}` : ''}
      </p>

      {!dayPlan && (
        <div className="empty-state">
          <h3>No plan for today</h3>
          <p>Import a CSV plan or create day plans in the Plan tab.</p>
        </div>
      )}

      {dayPlan && (
        <>
          {/* Must-Dos */}
          <h3 className="section-title">Must-Dos · {mustDoCompleted}/{dayPlan.mustDo.length}</h3>
          <div className="card">
            {dayPlan.mustDo.map((item, idx) => (
              <div key={idx} className="checkbox-row" onClick={() => toggleMustDo(db, idx)}>
                {dayPlan.mustDoDone[idx] ? (
                  <div className="checkbox-box checked">
                    <CheckSquare size={16} color="white" />
                  </div>
                ) : (
                  <div className="checkbox-box">
                    <Square size={16} color="transparent" />
                  </div>
                )}
                <span className="checkbox-label" style={{
                  textDecoration: dayPlan.mustDoDone[idx] ? 'line-through' : 'none',
                  color: dayPlan.mustDoDone[idx] ? 'var(--muted)' : 'var(--text)',
                }}>
                  {item}
                </span>
              </div>
            ))}
            {dayPlan.mustDo.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 14, padding: 8 }}>No must-dos for today</div>
            )}
          </div>

          {/* Sessions */}
          <h3 className="section-title">Sessions</h3>
          {sessions.length > 0 ? sessions.map((s) => (
            <div key={s.id} className="card session-card">
              <div>
                <div className="session-name">{s.routineName}</div>
                <div className="session-meta">
                  <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {s.status}
                </div>
              </div>
              {s.status === 'pending' ? (
                <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => navigate(`/session/${s.id}`)}>
                  <PlayCircle size={14} /> Start
                </button>
              ) : (
                <span className="session-status status-completed">
                  <CheckSquare size={14} /> Done
                </span>
              )}
            </div>
          )) : (
            <div className="card" style={{ color: 'var(--muted)', fontSize: 14, padding: 16, textAlign: 'center' }}>
              No sessions scheduled
            </div>
          )}

          {/* Day Modules */}
          {dayModuleSpecs.length > 0 && (
            <>
              <h3 className="section-title">Modules</h3>
              {dayModuleSpecs.map((spec) => {
                const mv = moduleValues.find((v) => v.moduleId === spec.id);
                return (
                  <div key={spec.id} className="card module-row">
                    <span className="module-emoji">{spec.emoji || '📦'}</span>
                    <div className="module-info" style={{ flex: 1 }}>
                      <div className="module-label">{spec.label}</div>
                      <span className="module-type">{spec.type.replace('_', ' ')}</span>
                    </div>
                    {spec.type === 'rating' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={20}
                            fill={Number(mv?.value ?? 0) >= n ? 'var(--accent)' : 'none'}
                            color="var(--accent)"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModuleValue(db, spec.id, String(n))}
                          />
                        ))}
                      </div>
                    )}
                    {spec.type === 'checkbox' && (
                      <div className="checkbox-box" style={mv?.value === 'true' ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                        onClick={() => setModuleValue(db, spec.id, mv?.value === 'true' ? 'false' : 'true')}>
                        {mv?.value === 'true' && <CheckSquare size={16} color="white" />}
                      </div>
                    )}
                    {spec.type === 'data_input' && (
                      <input type="number" className="data-input"
                        value={mv?.value ?? ''}
                        onChange={(e) => setModuleValue(db, spec.id, e.target.value)}
                        style={{ width: 80, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 14 }}
                      />
                    )}
                    {spec.type === 'text_note' && (
                      <input type="text" placeholder="Add note..."
                        value={mv?.value ?? ''}
                        onChange={(e) => setModuleValue(db, spec.id, e.target.value)}
                        style={{ width: 200, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 14 }}
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Notes */}
          {dayPlan.notes && (
            <>
              <h3 className="section-title">Notes</h3>
              <div className="card" style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text)' }}>
                {dayPlan.notes}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
