import { useEffect, useRef } from 'react';
import { monaco } from '../lib/monaco.js';

export default function Editor({ session, onRun }) {
  const containerRef = useRef(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useEffect(() => {
    const editor = monaco.editor.create(containerRef.current, {
      model: null,
      theme: 'codesynq',
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 4,
      renderWhitespace: 'selection',
      smoothScrolling: true,
      padding: { top: 12 },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current());
    session.attachEditor(editor);
    return () => {
      session.detachEditor();
      editor.dispose();
    };
  }, [session]);

  return <div className="editor" ref={containerRef} />;
}
