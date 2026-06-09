import React, { useState, useEffect, useCallback } from 'react';
import type { FileWithMeta } from '@archivault/core';

type View = 'files' | 'upload' | 'settings';

declare global {
  interface Window {
    archivault: {
      config: { load: () => Promise<Record<string, string>>; save: (u: Record<string, string>) => Promise<void> };
      files: {
        list: (opts: Record<string, unknown>) => Promise<FileWithMeta[]>;
        get: (id: string) => Promise<FileWithMeta | null>;
        upload: (opts: Record<string, unknown>) => Promise<{ fileId: string; s3Key: string }>;
        download: (fileId: string, destDir: string) => Promise<{ destPath: string; checksumMatch: boolean | null }>;
        delete: (id: string) => Promise<void>;
        archive: (id: string) => Promise<void>;
      };
      tags: { add: (id: string, tag: string) => Promise<void>; remove: (id: string, tag: string) => Promise<void> };
      props: { set: (id: string, name: string, value: string) => Promise<void>; remove: (id: string, name: string) => Promise<void> };
      dialog: { openDirectory: () => Promise<string | null>; saveFile: (name: string) => Promise<string | null> };
      on: (channel: string, listener: (...args: unknown[]) => void) => void;
      off: (channel: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

export function App(): React.ReactElement {
  const [view, setView] = useState<View>('files');
  const [files, setFiles] = useState<FileWithMeta[]>([]);
  const [selected, setSelected] = useState<FileWithMeta | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const results = await window.archivault.files.list({
        fileName: search || undefined,
        limit: 200,
        orderBy: 'uploaded_at',
        orderDir: 'desc',
      });
      setFiles(results);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async () => {
    const dir = await window.archivault.dialog.openDirectory();
    if (!dir) return;
    const config = await window.archivault.config.load();
    setView('upload');
    try {
      await window.archivault.files.upload({ bucket: config['bucket'], filePath: dir });
      await loadFiles();
      setView('files');
    } catch (e) {
      alert(`Upload failed: ${(e as Error).message}`);
      setView('files');
    }
  };

  const handleDownload = async (file: FileWithMeta) => {
    const dir = await window.archivault.dialog.openDirectory();
    if (!dir) return;
    try {
      const result = await window.archivault.files.download(file.id, dir);
      const integrity = result.checksumMatch === true ? ' ✔ Integrity verified.' : result.checksumMatch === false ? ' ✖ Checksum mismatch!' : '';
      alert(`Downloaded to: ${result.destPath}${integrity}`);
    } catch (e) {
      alert(`Download failed: ${(e as Error).message}`);
    }
  };

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>S3 Sync</div>
        <nav>
          {(['files', 'upload', 'settings'] as View[]).map((v) => (
            <button
              key={v}
              style={{ ...styles.navBtn, ...(view === v ? styles.navBtnActive : {}) }}
              onClick={() => v === 'upload' ? handleUpload() : setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
      </aside>

      <main style={styles.main}>
        {view === 'files' && (
          <FilesView
            files={files}
            selected={selected}
            onSelect={setSelected}
            onDownload={handleDownload}
            search={search}
            onSearch={setSearch}
            loading={loading}
          />
        )}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

function FilesView({
  files, selected, onSelect, onDownload, search, onSearch, loading,
}: {
  files: FileWithMeta[];
  selected: FileWithMeta | null;
  onSelect: (f: FileWithMeta | null) => void;
  onDownload: (f: FileWithMeta) => void;
  search: string;
  onSearch: (s: string) => void;
  loading: boolean;
}): React.ReactElement {
  return (
    <div style={styles.filesPane}>
      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          placeholder="Search by file name…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <span style={styles.count}>{files.length} files</span>
      </div>
      <div style={styles.tableWrapper}>
        {loading ? (
          <p style={styles.empty}>Loading…</p>
        ) : files.length === 0 ? (
          <p style={styles.empty}>No files found. Click Upload to add files.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Size', 'Uploaded', 'Tags'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  style={{ ...styles.tr, ...(selected?.id === f.id ? styles.trSelected : {}) }}
                  onClick={() => onSelect(f)}
                >
                  <td style={styles.td}>{f.fileName}</td>
                  <td style={styles.td}>{formatBytes(f.fileSize)}</td>
                  <td style={styles.td}>{new Date(f.uploadedAt).toLocaleDateString()}</td>
                  <td style={styles.td}>{f.tags.join(', ')}</td>
                  <td style={styles.td}>
                    <button style={styles.actionBtn} onClick={(e) => { e.stopPropagation(); onDownload(f); }}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SettingsView(): React.ReactElement {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.archivault.config.load().then(setConfig);
  }, []);

  const handleSave = async () => {
    await window.archivault.config.save(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={styles.settingsPane}>
      <h2>Settings</h2>
      {['bucket', 'region', 'profile', 'storageClass'].map((key) => (
        <label key={key} style={styles.settingsField}>
          <span style={styles.settingsLabel}>{key}</span>
          <input
            style={styles.settingsInput}
            value={config[key] ?? ''}
            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
          />
        </label>
      ))}
      <button style={styles.saveBtn} onClick={handleSave}>
        {saved ? 'Saved!' : 'Save Configuration'}
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#1a1a1a', background: '#f5f5f5' },
  sidebar: { width: 160, background: '#1e1e2e', display: 'flex', flexDirection: 'column', padding: '16px 0' },
  logo: { color: '#cdd6f4', fontWeight: 700, fontSize: 16, padding: '0 16px 20px' },
  navBtn: { display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'transparent', color: '#a6adc8', cursor: 'pointer', fontSize: 13 },
  navBtnActive: { background: '#313244', color: '#cdd6f4' },
  main: { flex: 1, overflow: 'auto' },
  filesPane: { display: 'flex', flexDirection: 'column', height: '100%' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e0e0e0', background: '#fff' },
  searchInput: { flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
  count: { color: '#666', fontSize: 12 },
  tableWrapper: { flex: 1, overflow: 'auto', padding: 0 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#666', borderBottom: '1px solid #e0e0e0', background: '#fafafa', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { cursor: 'pointer', borderBottom: '1px solid #f0f0f0' },
  trSelected: { background: '#e8f0fe' },
  td: { padding: '8px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actionBtn: { padding: '3px 8px', fontSize: 11, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' },
  empty: { padding: 40, textAlign: 'center', color: '#999' },
  settingsPane: { padding: 32, maxWidth: 480 },
  settingsField: { display: 'flex', flexDirection: 'column', marginBottom: 16 },
  settingsLabel: { fontWeight: 600, marginBottom: 4, fontSize: 12, color: '#555' },
  settingsInput: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 },
  saveBtn: { marginTop: 8, padding: '8px 20px', background: '#1e1e2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
};
