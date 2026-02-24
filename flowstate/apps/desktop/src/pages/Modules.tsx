import { useEffect, useState, useCallback } from 'react';
import { Archive, Plus, Timer, Hash, FileText, CheckCircle, TrendingUp, Target, Trash2, X } from 'lucide-react';
import { useDatabaseReady, useDatabase } from '../components/DatabaseProvider';
import { useModuleStore } from '../stores/moduleStore';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  countdown: <Timer size={16} />,
  countup: <Timer size={16} />,
  data_input: <Hash size={16} />,
  text_note: <FileText size={16} />,
  streak_counter: <TrendingUp size={16} />,
  checkbox: <CheckCircle size={16} />,
  mandatory_session: <Target size={16} />,
  rating: <TrendingUp size={16} />,
  progress_bar: <TrendingUp size={16} />,
};

const MODULE_TYPE_OPTIONS = [
  { value: 'countdown', label: 'Countdown' },
  { value: 'countup', label: 'Count Up' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'rating', label: 'Rating' },
  { value: 'data_input', label: 'Data Input' },
  { value: 'text_note', label: 'Text Note' },
  { value: 'streak_counter', label: 'Streak Counter' },
  { value: 'progress_bar', label: 'Progress Bar' },
  { value: 'mandatory_session', label: 'Mandatory Session' },
];

interface CreateForm {
  label: string;
  type: string;
  emoji: string;
  isLive: boolean;
}

export function ModulesPage() {
  const ready = useDatabaseReady();
  const modules = useModuleStore((s) => s.modules);
  const loadModules = useModuleStore((s) => s.loadModules);
  const createModule = useModuleStore((s) => s.createModule);
  const archiveModule = useModuleStore((s) => s.archiveModule);
  const deleteModule = useModuleStore((s) => s.deleteModule);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>({ label: '', type: 'checkbox', emoji: '📦', isLive: false });
  const [archivedModules, setArchivedModules] = useState<any[]>([]);

  let db: any = null;
  try { if (ready) db = useDatabase(); } catch { /* not ready */ }

  const loadData = useCallback(async () => {
    if (!db) return;
    await loadModules(db);
    // Load archived separately
    try {
      const all = await import('@flowstate/core').then((m) => m.getModuleSpecs(db));
      setArchivedModules(all.filter((m: any) => m.archivedAt));
    } catch { /* ignore */ }
  }, [db, loadModules]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!db || !form.label.trim()) return;
    const id = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await createModule(db, {
      id,
      type: form.type,
      label: form.label.trim(),
      emoji: form.emoji || '📦',
      config: {},
      placements: form.isLive ? ['homescreen'] : ['day'],
      isLive: form.isLive,
      required: false,
    });
    setForm({ label: '', type: 'checkbox', emoji: '📦', isLive: false });
    setShowCreate(false);
  };

  const active = modules.filter((m) => !m.archivedAt);

  if (!ready) {
    return <div className="empty-state"><h3>Loading...</h3></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Modules</h1>
          <p className="page-subtitle">{active.length} active · {archivedModules.length} archived</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Create Module</>}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Emoji</label>
              <input type="text" value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 20, textAlign: 'center' }}
                maxLength={2} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Label</label>
              <input type="text" value={form.label} placeholder="Module name..."
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
                {MODULE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={form.isLive}
                onChange={(e) => setForm({ ...form, isLive: e.target.checked })} />
              Live on homescreen
            </label>
            <button className="btn-primary" onClick={handleCreate} disabled={!form.label.trim()}>
              Create
            </button>
          </div>
        </div>
      )}

      {/* Active modules */}
      <h3 className="section-title">Active</h3>
      {active.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {active.map((m, idx) => (
            <div key={m.id} className="module-row"
              style={{ borderBottom: idx < active.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span className="module-emoji">{m.emoji || '📦'}</span>
              <div className="module-info" style={{ flex: 1 }}>
                <div className="module-label">{m.label}</div>
                <span className="module-type">
                  {TYPE_ICONS[m.type] || null} {m.type.replace('_', ' ')}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize', marginRight: 8 }}>
                {m.placements.join(', ')}
              </span>
              <button title="Archive" onClick={() => db && archiveModule(db, m.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <Archive size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
          No modules yet. Create your first one above.
        </div>
      )}

      {/* Archived modules */}
      {archivedModules.length > 0 && (
        <>
          <h3 className="section-title">
            <Archive size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Archived
          </h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {archivedModules.map((m: any) => (
              <div key={m.id} className="module-row" style={{ opacity: 0.6 }}>
                <span className="module-emoji">{m.emoji || '📦'}</span>
                <div className="module-info" style={{ flex: 1 }}>
                  <div className="module-label">{m.label}</div>
                  <span className="module-type">{m.type.replace('_', ' ')}</span>
                </div>
                <button title="Delete permanently" onClick={() => db && deleteModule(db, m.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
