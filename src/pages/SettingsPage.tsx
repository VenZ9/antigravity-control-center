import React, { useEffect, useState } from 'react';
import { 
  Settings, Save, Shield, RotateCcw, Plus, 
  Trash2, Check, AlertCircle 
} from 'lucide-react';
import { SettingsData } from '../types';
import { API } from '../api/client';

export const SettingsPage: React.FC = () => {
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [model, setModel] = useState('Gemini 3.8 Flash (High)');
  const [editor, setEditor] = useState('vim');
  const [editorMode, setEditorMode] = useState<'vim' | 'insert' | 'emacs'>('vim');
  const [trustedWorkspaces, setTrustedWorkspaces] = useState<string[]>([]);
  const [newWorkspace, setNewWorkspace] = useState('');
  const [useTerminalCursor, setUseTerminalCursor] = useState(false);
  const [seasonalThemesOff, setSeasonalThemesOff] = useState(false);
  const [copyOnSelect, setCopyOnSelect] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await API.getSettings();
      setSettingsData(res);
      const s = res.settings || {};
      if (s.model) setModel(s.model);
      if (s.editor) setEditor(s.editor);
      if (s.editorMode) setEditorMode(s.editorMode);
      if (Array.isArray(s.trustedWorkspaces)) setTrustedWorkspaces(s.trustedWorkspaces);
      if (typeof s.useTerminalCursor === 'boolean') setUseTerminalCursor(s.useTerminalCursor);
      if (typeof s.seasonalThemesOff === 'boolean') setSeasonalThemesOff(s.seasonalThemesOff);
      if (typeof s.copyOnSelect === 'boolean') setCopyOnSelect(s.copyOnSelect);
    } catch (err: any) {
      setMessage({ text: `Failed to load settings: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const res = await API.updateSettings({
        model,
        editor,
        editorMode,
        trustedWorkspaces,
        useTerminalCursor,
        seasonalThemesOff,
        copyOnSelect
      }, settingsData?.mtime || null);

      setSettingsData(prev => prev ? { ...prev, settings: res.settings, mtime: res.mtime } : null);
      setMessage({ text: 'Settings saved atomically and backed up successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('Are you sure you want to restore the previous settings backup?')) return;
    try {
      setLoading(true);
      await API.restoreSettings();
      await loadSettings();
      setMessage({ text: 'Settings restored from backup.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: `Restore failed: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const addWorkspace = () => {
    if (newWorkspace.trim() && !trustedWorkspaces.includes(newWorkspace.trim())) {
      setTrustedWorkspaces([...trustedWorkspaces, newWorkspace.trim()]);
      setNewWorkspace('');
    }
  };

  const removeWorkspace = (index: number) => {
    setTrustedWorkspaces(trustedWorkspaces.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Title & Security Guard Banner */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Settings size={18} style={{ color: 'var(--accent-violet)' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
            Antigravity Configuration
          </h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Directly modifies <code>~/.gemini/antigravity-cli/settings.json</code> using atomic writes with automatic backup.
        </p>

        <div style={{
          marginTop: '12px', padding: '10px 12px', borderRadius: '8px',
          background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)',
          fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <Shield size={14} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
          <span>Protected: OAuth credentials, installation UUIDs, and protobuf internals are strictly preserved and never modified.</span>
        </div>
      </div>

      {/* Status Message Alert */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)'
        }}>
          {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map(n => <div key={n} className="skeleton" style={{ height: '70px', width: '100%' }} />)}
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Model Selection */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Default Model
              </label>
              <select
                className="input-field"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                {(settingsData?.supportedModels || [
                  'Gemini 3.8 Flash (High)',
                  'Gemini 3.8 Flash (Medium)',
                  'Gemini 3.8 Flash (Low)',
                  'Claude Sonnet 4.6 (Thinking)',
                  'Claude Opus 4.6 (Thinking)',
                  'GPT-OSS 120B (Medium)'
                ]).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Sets the model used for new interactive CLI and print turns.
              </span>
            </div>

            {/* Editor & Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  External Editor
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. vim or nano"
                  value={editor}
                  onChange={e => setEditor(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Editor Keymap Mode
                </label>
                <select
                  className="input-field"
                  value={editorMode}
                  onChange={e => setEditorMode(e.target.value as any)}
                >
                  <option value="vim">Vim Mode</option>
                  <option value="insert">Insert Mode (Standard)</option>
                  <option value="emacs">Emacs Mode</option>
                </select>
              </div>
            </div>

            {/* Trusted Workspaces */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Trusted Workspaces
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                {trustedWorkspaces.map((ws, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px',
                      border: '1px solid var(--border-subtle)', fontSize: '12px', fontFamily: 'monospace'
                    }}
                  >
                    <span>{ws}</span>
                    <button
                      type="button"
                      onClick={() => removeWorkspace(i)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Add directory path (e.g. ~/myproject or C:\projects\myproject)"
                  value={newWorkspace}
                  onChange={e => setNewWorkspace(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addWorkspace}
                  className="btn btn-secondary"
                  style={{ minHeight: '44px', padding: '0 16px' }}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={useTerminalCursor}
                  onChange={e => setUseTerminalCursor(e.target.checked)}
                />
                <span>Use Terminal Hardware Cursor</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={seasonalThemesOff}
                  onChange={e => setSeasonalThemesOff(e.target.checked)}
                />
                <span>Disable Seasonal Decorative Themes</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={copyOnSelect}
                  onChange={e => setCopyOnSelect(e.target.checked)}
                />
                <span>Auto-copy text to clipboard on selection</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              onClick={handleRestore}
              className="btn btn-secondary"
              style={{ fontSize: '12px' }}
            >
              <RotateCcw size={13} />
              Restore from Backup (.bak)
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ minWidth: '130px' }}
            >
              <Save size={14} />
              {saving ? 'Writing...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
