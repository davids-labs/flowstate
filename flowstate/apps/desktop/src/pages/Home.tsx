import { useEffect, useState, useCallback, useMemo } from 'react';
import { Clock, PlayCircle, Target, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseReady, useDatabase } from '../components/useDatabase';
import { useModuleStore } from '../stores/moduleStore';
import { useDayStore } from '../stores/dayStore';
import * as queries from '@flowstate/core';

interface LiveModule {
  id: string;
  label: string;
  emoji?: string;
  type: string;
  value: string;
}

interface LoggedModule {
  id: string;
  label: string;
  value: string;
}

export function HomePage() {
  const navigate = useNavigate();
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [sessionsTotal, setSessionsTotal] = useState(0);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Must call hooks unconditionally
  const dayPlan = useDayStore((s) => s.dayPlan);
  const loadDay = useDayStore((s) => s.loadDay);
  const moduleValues = useDayStore((s) => s.moduleValues);
  const modules = useModuleStore((s) => s.modules);
  const loadModules = useModuleStore((s) => s.loadModules);
  const getLiveModules = useModuleStore((s) => s.getLiveModules);

  
  const loadData = useCallback(async () => {
    if (!db) return;
    await loadModules(db);
    await loadDay(db, todayStr);
  }, [db, todayStr, loadModules, loadDay]);

  useEffect(() => { loadData(); }, [loadData]);

  const liveModules = useMemo(() => {
    const live = getLiveModules();
    return live.map((m) => {
      const mv = moduleValues.find((v) => v.moduleId === m.id);
      let value = mv?.value ?? '';
      if (m.type === 'countdown') {
        const cfg = m.config as { targetDate?: string };
        if (cfg.targetDate) {
          const diff = Math.ceil((new Date(cfg.targetDate).getTime() - Date.now()) / 86_400_000);
          value = String(Math.max(0, diff));
        }
      } else if (m.type === 'countup') {
        const cfg = m.config as { originDate?: string };
        if (cfg.originDate) {
          const diff = Math.floor((Date.now() - new Date(cfg.originDate).getTime()) / 86_400_000);
          value = String(Math.max(0, diff));
        }
      }
      return { id: m.id, label: m.label, emoji: m.emoji, type: m.type, value };
    });
  }, [moduleValues, modules, getLiveModules]);

  const loggedModules = useMemo(() => {
    const logged: LoggedModule[] = [];
    for (const mv of moduleValues) {
      const spec = modules.find((m) => m.id === mv.moduleId);
      if (spec && !spec.isLive) {
        logged.push({ id: spec.id, label: spec.label, value: mv.value });
      }
    }
    return logged;
  }, [modules, moduleValues]);

  // Load sessions
  useEffect(() => {
    if (!db || !dayPlan) return;
    queries.getSessions(db, dayPlan.id).then((ss: { status: string }[]) => {
      setSessionsTotal(ss.length);
      setSessionsCompleted(ss.filter((s) => s.status === 'completed').length);
    }).catch(() => {});
  }, [db, dayPlan]);

  const mustDoCompleted = dayPlan?.mustDoDone.filter(Boolean).length ?? 0;
  const mustDoTotal = dayPlan?.mustDo.length ?? 0;
  const totalTasks = mustDoTotal + sessionsTotal;
  const totalDone = mustDoCompleted + sessionsCompleted;
  const pct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  if (!ready) {
    return <div className="empty-state"><h3>Loading database...</h3></div>;
  }

  return (
    <div>
      <h1 className="page-title">Home</h1>
      <p className="page-subtitle">Your FlowState at a glance</p>

      <h3 className="section-title">Live Modules</h3>
      {liveModules.length > 0 ? (
        <div className="card-grid">
          {liveModules.map((m) => (
            <div key={m.id} className="card countdown-card">
              <div className="countdown-count">{m.value || '—'}</div>
              <div className="countdown-unit">
                {m.type === 'countdown' || m.type === 'countup' ? 'days' : m.type === 'streak_counter' ? 'day streak' : ''}
              </div>
              <div className="countdown-label">{m.emoji ? `${m.emoji} ` : ''}{m.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
          No live modules yet. Create one in Modules.
        </div>
      )}

      <h3 className="section-title">Today</h3>
      {dayPlan ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="day-title">{dayPlan.title}</div>
              <div className="day-meta">
                <Target size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {mustDoCompleted}/{mustDoTotal} must-dos
                <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {sessionsCompleted}/{sessionsTotal} sessions
              </div>
            </div>
            <button className="btn-primary" onClick={() => navigate('/today')}>
              <PlayCircle size={16} /> View Today
            </button>
          </div>
          <div className="progress-track" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
          No plan for today. Import a CSV in Plan tab.
        </div>
      )}

      {loggedModules.length > 0 && (
        <>
          <h3 className="section-title">Logged Today</h3>
          {loggedModules.map((m) => (
            <div key={m.id} className="card module-row">
              <TrendingUp size={20} style={{ color: 'var(--accent)' }} />
              <div className="module-info">
                <div className="module-label">{m.label}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{m.value}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
