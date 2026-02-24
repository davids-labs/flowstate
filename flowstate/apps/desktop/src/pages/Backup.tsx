import { useState } from 'react';
import { Upload, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDatabaseReady, useDatabase } from '../components/DatabaseProvider';
import { exportBackup, importBackup } from '@flowstate/core';

export function BackupPage() {
  const ready = useDatabaseReady();
  let db: any = null;
  try { if (ready) db = useDatabase(); } catch {}

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    if (!db) return;
    setBusy(true);
    setStatus(null);
    try {
      const data = await exportBackup(db);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowstate-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${Object.keys(data.tables).length} tables successfully.`);
    } catch (e: any) {
      setStatus(`Export failed: ${e.message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!db) return;
    if (!confirm('This will REPLACE all existing data. Are you sure?')) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      setStatus(null);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version || !data.tables) {
          setStatus('Invalid file – not a FlowState backup.');
          setBusy(false);
          return;
        }
        const { tablesRestored, rowsRestored } = await importBackup(db, data);
        setStatus(`Restored ${tablesRestored} tables, ${rowsRestored} rows.`);
      } catch (e: any) {
        setStatus(`Import failed: ${e.message ?? 'unknown error'}`);
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  return (
    <div>
      <h1 className="page-title">Backup & Restore</h1>
      <p className="page-subtitle">
        Export your entire FlowState database as JSON, or import a previous backup.
      </p>

      {status && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <CheckCircle size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 14 }}>{status}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button className="btn-primary" onClick={handleExport} disabled={busy || !ready}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 14 }}>
          <Upload size={16} />
          Export Backup
        </button>
        <button className="btn-secondary" onClick={handleImport} disabled={busy || !ready}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 14 }}>
          <Download size={16} />
          Import Backup
        </button>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          Importing will <strong>replace all existing data</strong>. Export a backup first if you want to
          keep your current data.
        </p>
      </div>
    </div>
  );
}
