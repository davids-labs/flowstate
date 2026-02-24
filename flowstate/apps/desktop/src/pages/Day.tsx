import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Clock, PlayCircle, Square, Star } from 'lucide-react';
import { useDatabaseReady, useDatabase } from '../components/DatabaseProvider';
import { useDayStore } from '../stores/dayStore';
import * as queries from '@flowstate/core';
import { useState } from 'react';

interface SessionRow {
  id: string;
  routineName: string;
  status: string;
}

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const ready = useDatabaseReady();

  const dayPlan = useDayStore((s) => s.dayPlan);
  const loadDay = useDayStore((s) => s.loadDay);
  const toggleMustDo = useDayStore((s) => s.toggleMustDo);
  const moduleValues = useDayStore((s) => s.moduleValues);
  const setModuleValue = useDayStore((s) => s.setModuleValue);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [moduleSpecs, setModuleSpecs] = useState<any[]>([]);

  let db: any = null;
  try { if (ready) db = useDatabase(); } catch { /* not ready */ }

  const loadData = useCallback(async () => {
    if (!db || !date) return;
    await loadDay(db, date);
    const specs = await queries.getModuleSpecs(db);
    setModuleSpecs(specs);
  }, [db, date, loadDay]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!db || !dayPlan) return;
    queries.getSessions(db, dayPlan.id).then((ss: any[]) => {
      setSessions(ss.map((s: any) => ({ id: s.id, routineName: s.routineName, status: s.status })));
    }).catch(() => {});
  }, [db, dayPlan]);

  if (!ready) return <div className="empty-state"><h3>Loading...</h3></div>;

  const dateObj = date ? new Date(date + 'T12:00:00') : new Date();
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const dayModuleSpecs = dayPlan?.moduleIds
    ? moduleSpecs.filter((m: any) => dayPlan.moduleIds.includes(m.id))
    : [];

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="page-title">{dayPlan?.title ?? 'Day'}</h1>
      <p className="page-subtitle">
        {dateLabel}
        {dayPlan?.dayNumber ? ` · Day ${dayPlan.dayNumber}` : ''}
        {dayPlan?.totalDays ? ` of ${dayPlan.totalDays}` : ''}
      </p>

      {!dayPlan && (
        <div className="empty-state"><h3>No plan for this day</h3></div>
      )}

      {dayPlan && (
        <>
          {/* Must-Dos */}
          <h3 className="section-title">Must-Dos · {dayPlan.mustDoDone.filter(Boolean).length}/{dayPlan.mustDo.length}</h3>
          <div className="card">
            {dayPlan.mustDo.map((item, idx) => (
              <div key={idx} className="checkbox-row" onClick={() => db && toggleMustDo(db, idx)}>
                {dayPlan.mustDoDone[idx] ? (
                  <div className="checkbox-box checked"><CheckSquare size={16} color="white" /></div>
                ) : (
                  <div className="checkbox-box"><Square size={16} color="transparent" /></div>
                )}
                <span className="checkbox-label" style={{
                  textDecoration: dayPlan.mustDoDone[idx] ? 'line-through' : 'none',
                  color: dayPlan.mustDoDone[idx] ? 'var(--muted)' : 'var(--text)',
                }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Sessions */}
          <h3 className="section-title">Sessions</h3>
          {sessions.map((s) => (
            <div key={s.id} className="card session-card">
              <div>
                <div className="session-name">{s.routineName}</div>
                <div className="session-meta"><Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />{s.status}</div>
              </div>
              {s.status === 'pending' ? (
                <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => navigate(`/session/${s.id}`)}>
                  <PlayCircle size={14} /> Start
                </button>
              ) : (
                <span className="session-status status-completed"><CheckSquare size={14} /> Done</span>
              )}
            </div>
          ))}

          {/* Modules */}
          {dayModuleSpecs.length > 0 && (
            <>
              <h3 className="section-title">Modules</h3>
              {dayModuleSpecs.map((spec: any) => {
                const mv = moduleValues.find((v) => v.moduleId === spec.id);
                return (
                  <div key={spec.id} className="card module-row">
                    <span className="module-emoji">{spec.emoji || '📦'}</span>
                    <div className="module-info" style={{ flex: 1 }}>
                      <div className="module-label">{spec.label}</div>
                    </div>
                    {spec.type === 'rating' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={20} fill={Number(mv?.value ?? 0) >= n ? 'var(--accent)' : 'none'} color="var(--accent)"
                            style={{ cursor: 'pointer' }} onClick={() => db && setModuleValue(db, spec.id, String(n))} />
                        ))}
                      </div>
                    )}
                    {spec.type === 'checkbox' && (
                      <div className="checkbox-box" style={mv?.value === 'true' ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                        onClick={() => db && setModuleValue(db, spec.id, mv?.value === 'true' ? 'false' : 'true')}>
                        {mv?.value === 'true' && <CheckSquare size={16} color="white" />}
                      </div>
                    )}
                    {spec.type === 'data_input' && (
                      <input type="number" value={mv?.value ?? ''}
                        onChange={(e) => db && setModuleValue(db, spec.id, e.target.value)}
                        style={{ width: 80, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 14 }} />
                    )}
                    {spec.type === 'text_note' && (
                      <input type="text" placeholder="Add note..." value={mv?.value ?? ''}
                        onChange={(e) => db && setModuleValue(db, spec.id, e.target.value)}
                        style={{ width: 200, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 14 }} />
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
