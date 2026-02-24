import { useState } from 'react';
import { saveDatabase } from '../db';
import { Database, Download, Trash2, User, Moon, Sun } from 'lucide-react';

export function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [saving, setSaving] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDatabase();
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) return;
    try {
      indexedDB.deleteDatabase('flowstate_desktop');
      setCleared(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error('Clear failed:', e);
    }
  };

  const handleExport = async () => {
    try {
      await saveDatabase();
      // Export from IndexedDB
      const idb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('flowstate_desktop', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = idb.transaction('databases', 'readonly');
      const store = tx.objectStore('databases');
      const data = await new Promise<Uint8Array>((resolve, reject) => {
        const req = store.get('main');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (data) {
        const blob = new Blob([data as BlobPart], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowstate-backup-${new Date().toISOString().slice(0, 10)}.db`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">FlowState Desktop Configuration</p>

      {/* Theme */}
      <h3 className="section-title">Appearance</h3>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
          <span style={{ fontSize: 15, fontWeight: 600 }}>Theme</span>
        </div>
        <button className="btn-secondary" onClick={toggleTheme} style={{ padding: '6px 16px', fontSize: 13 }}>
          {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
        </button>
      </div>

      {/* Database */}
      <h3 className="section-title">Database</h3>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={18} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Force Save</span>
          </div>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '6px 16px', fontSize: 13 }}>
            {saving ? 'Saving...' : 'Save Now'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Download size={18} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Export Backup</span>
          </div>
          <button className="btn-secondary" onClick={handleExport} style={{ padding: '6px 16px', fontSize: 13 }}>
            Export .db
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trash2 size={18} color="var(--danger)" />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--danger)' }}>Clear All Data</span>
          </div>
          <button onClick={handleClearData}
            style={{ background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {cleared ? 'Cleared!' : 'Clear'}
          </button>
        </div>
      </div>

      {/* Sync */}
      <h3 className="section-title">Cloud Sync</h3>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <User size={18} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Account</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          Sign in to sync your data across devices. Uses Firebase anonymous auth by default.
        </p>
        <button className="btn-secondary" style={{ marginTop: 12, padding: '6px 16px', fontSize: 13 }}>
          Sign In Anonymously
        </button>
      </div>

      {/* About */}
      <h3 className="section-title">About</h3>
      <div className="card">
        <p style={{ fontSize: 14, color: 'var(--text)' }}>
          <strong>FlowState Desktop</strong> v1.0.0
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Structured daily planning & habit tracking. Built with React, Electron, and sql.js.
        </p>
      </div>
    </div>
  );
}
