import { useState } from 'react';
import { languageForFile, validateFileName } from '@codesynq/shared';

function NameInput({ initial = '', placeholder, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');

  const submit = async () => {
    const name = value.trim();
    if (name === initial) return onCancel();
    const problem = validateFileName(name);
    if (problem) return setError(problem);
    try {
      await onSubmit(name);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="name-input">
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={() => !error && onCancel()}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

export default function FileTree({ session, files, activeFileId, users }) {
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState(null);

  const remove = async (file) => {
    if (!window.confirm(`Delete ${file.name} for everyone in this room?`)) return;
    try {
      await session.deleteFile(file.id);
    } catch (err) {
      session.notify(err.message, 'error');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Files</span>
        <button className="icon-btn" title="New file" onClick={() => setCreating(true)}>+</button>
      </div>
      <ul className="file-list">
        {files.map((file) => {
          const lang = languageForFile(file.name);
          const here = users.filter((u) => u.selection?.fileId === file.id);
          if (renamingId === file.id) {
            return (
              <li key={file.id}>
                <NameInput
                  initial={file.name}
                  onSubmit={async (name) => {
                    await session.renameFile(file.id, name);
                    setRenamingId(null);
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              </li>
            );
          }
          return (
            <li key={file.id}>
              <button
                className={`file ${file.id === activeFileId ? 'active' : ''}`}
                onClick={() => session.setActiveFile(file.id)}
                onDoubleClick={() => setRenamingId(file.id)}
                title={`${file.name} — ${lang.label}${lang.piston ? '' : ' (not runnable)'}`}
              >
                <span className="file-ext">{lang.ext || 'txt'}</span>
                <span className="file-name">{file.name}</span>
                <span className="file-presence">
                  {here.map((u) => (
                    <i key={u.id} style={{ background: u.color }} title={u.name} />
                  ))}
                </span>
              </button>
              <span className="file-actions">
                <button className="icon-btn" title="Rename" onClick={() => setRenamingId(file.id)}>{'✎'}</button>
                <button className="icon-btn" title="Delete" onClick={() => remove(file)}>{'×'}</button>
              </span>
            </li>
          );
        })}
        {creating && (
          <li>
            <NameInput
              placeholder="name.ext"
              onSubmit={async (name) => {
                await session.createFile(name);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          </li>
        )}
      </ul>
      <p className="sidebar-hint">The extension picks the language. Double-click a file to rename it.</p>
    </aside>
  );
}
