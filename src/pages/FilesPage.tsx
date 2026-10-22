import React, { useEffect, useState } from 'react';
import { 
  Folder, FileText, GitBranch, ArrowUp, ShieldAlert, 
  FileDiff, Eye, X, GitCommit, CheckCircle2 
} from 'lucide-react';
import { FileEntry, GitStatus } from '../types';
import { API } from '../api/client';

export const FilesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'files' | 'git'>('files');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // File Preview
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Git State
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitDiff, setGitDiff] = useState<string>('');
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);

  useEffect(() => {
    loadDirectory(currentPath);
    loadGitStatus(currentPath);
  }, [currentPath]);

  const loadDirectory = async (dir: string) => {
    try {
      setLoading(true);
      const res = await API.getFileTree(dir);
      setCurrentPath(res.currentPath);
      setParentPath(res.parentPath);
      setEntries(res.entries || []);
    } catch (err: any) {
      alert(`Directory load error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadGitStatus = async (dir: string) => {
    try {
      const res = await API.getGitStatus(dir);
      setGitStatus(res);
      if (res.isGitRepo) {
        loadGitDiff(dir);
      }
    } catch {}
  };

  const loadGitDiff = async (dir: string, file?: string) => {
    try {
      const res = await API.getGitDiff(dir, file);
      setGitDiff(res.diff || 'No uncommitted changes detected.');
    } catch {}
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      setPreviewFile(null);
      loadDirectory(entry.path);
    } else {
      openFilePreview(entry.path);
    }
  };

  const openFilePreview = async (filePath: string) => {
    try {
      setPreviewLoading(true);
      const res = await API.getFilePreview(filePath);
      setPreviewFile(res);
    } catch (err: any) {
      alert(`Preview error: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSelectDiffFile = (file: string | null) => {
    setSelectedDiffFile(file);
    loadGitDiff(currentPath, file || undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Tabs */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('files')}
            style={{
              background: activeTab === 'files' ? 'var(--accent-violet)' : 'transparent',
              color: activeTab === 'files' ? '#fff' : 'var(--text-secondary)',
              border: 'none', borderRadius: '6px', padding: '6px 14px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Folder size={14} />
            File Explorer
          </button>
          <button
            onClick={() => setActiveTab('git')}
            style={{
              background: activeTab === 'git' ? 'var(--accent-violet)' : 'transparent',
              color: activeTab === 'git' ? '#fff' : 'var(--text-secondary)',
              border: 'none', borderRadius: '6px', padding: '6px 14px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <GitBranch size={14} />
            Git Status {gitStatus?.uncommittedCount ? `(${gitStatus.uncommittedCount})` : ''}
          </button>
        </div>

        {/* Current Path breadcrumb */}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentPath}
        </div>
      </div>

      {activeTab === 'files' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {/* File Tree Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>Directory Listing</span>
              {parentPath && (
                <button
                  onClick={() => loadDirectory(parentPath)}
                  className="btn btn-secondary"
                  style={{ minHeight: '30px', height: '30px', padding: '0 10px', fontSize: '11px', borderRadius: '6px' }}
                >
                  <ArrowUp size={12} />
                  Up Directory
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0' }}>
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="skeleton" style={{ height: '36px', width: '100%' }} />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Folder is empty.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '350px', overflowY: 'auto' }}>
                {entries.map(entry => (
                  <div
                    key={entry.name}
                    onClick={() => handleEntryClick(entry)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '6px',
                      background: previewFile?.path === entry.path ? 'var(--accent-violet-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${previewFile?.path === entry.path ? 'var(--accent-violet)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ color: entry.isDirectory ? 'var(--accent-violet)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {entry.isDirectory ? <Folder size={15} /> : <FileText size={15} />}
                    </span>
                    <span style={{
                      color: entry.isSensitive ? 'var(--danger)' : 'var(--text-main)',
                      fontWeight: entry.isDirectory ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {entry.name}
                    </span>
                    {entry.isSensitive && (
                      <span className="badge badge-warning" style={{ marginLeft: 'auto', fontSize: '9px', padding: '2px 5px' }}>
                        <ShieldAlert size={10} style={{ marginRight: '3px' }} />
                        Protected
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Preview Card */}
          {previewFile && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Eye size={14} style={{ color: 'var(--accent-violet)' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>
                    {previewFile.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({Math.round(previewFile.size / 1024)} KB)
                  </span>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={15} />
                </button>
              </div>

              {previewLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading file content...
                </div>
              ) : (
                <div className="code-box" style={{ maxHeight: '400px' }}>
                  {previewFile.content}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Git Status & Diff Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!gitStatus?.isGitRepo ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <GitBranch size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Selected workspace is not a Git repository.
              </div>
            </div>
          ) : (
            <>
              {/* Branch & Summary Bar */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-violet">
                    <GitBranch size={11} style={{ marginRight: '3px' }} />
                    Branch
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                    {gitStatus.branch}
                  </span>
                </div>
                <span className="badge" style={{ background: '#171B2A', color: '#94A3B8', border: '1px solid var(--border-subtle)' }}>
                  <FileDiff size={11} style={{ marginRight: '3px' }} />
                  {gitStatus.files.length} Uncommitted Files
                </span>
              </div>

              {/* Changed Files List */}
              {gitStatus.files.length > 0 && (
                <div className="card">
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>Changed Files</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      onClick={() => handleSelectDiffFile(null)}
                      className="btn"
                      style={{
                        minHeight: '30px', height: '30px', padding: '0 10px', fontSize: '11px',
                        background: selectedDiffFile === null ? 'var(--accent-violet)' : 'var(--bg-elevated)',
                        color: '#fff', borderRadius: '6px'
                      }}
                    >
                      All Changes
                    </button>
                    {gitStatus.files.map(f => (
                      <button
                        key={f.path}
                        onClick={() => handleSelectDiffFile(f.path)}
                        className="btn"
                        style={{
                          minHeight: '30px', height: '30px', padding: '0 10px', fontSize: '11px',
                          background: selectedDiffFile === f.path ? 'var(--accent-violet)' : 'var(--bg-elevated)',
                          color: '#fff', borderRadius: '6px'
                        }}
                      >
                        <span style={{ color: 'var(--warning)', marginRight: '4px' }}>{f.status}</span>
                        {f.path}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Diff Viewer */}
              <div className="card">
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-main)' }}>
                  Unified Diff {selectedDiffFile ? `(${selectedDiffFile})` : ''}
                </div>
                <div className="code-box" style={{ maxHeight: '450px' }}>
                  {gitDiff.split('\n').map((line, i) => {
                    let color = '#CBD5E1';
                    if (line.startsWith('+') && !line.startsWith('+++')) color = 'var(--success)';
                    if (line.startsWith('-') && !line.startsWith('---')) color = 'var(--danger)';
                    if (line.startsWith('@@')) color = 'var(--accent-violet)';
                    return (
                      <div key={i} style={{ color, whiteSpace: 'pre-wrap' }}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
