function Result({ result }) {
  if (!result.ok) return <pre className="out-stderr">{result.error}</pre>;
  const { compile, run } = result;
  const compileFailed = compile && compile.code !== 0;
  return (
    <>
      {compile?.output && <pre className={compileFailed ? 'out-stderr' : 'out-muted'}>{compile.output}</pre>}
      {run.stdout && <pre className="out-stdout">{run.stdout}</pre>}
      {run.stderr && <pre className="out-stderr">{run.stderr}</pre>}
      {!compile?.output && !run.stdout && !run.stderr && <pre className="out-muted">(no output)</pre>}
      <p className="out-meta">
        {result.language} {result.version} · exit code {run.code ?? '—'}
        {run.signal ? ` · ${run.signal}` : ''} · {result.durationMs} ms
      </p>
    </>
  );
}

export default function OutputPanel({ run, stdin, onStdinChange }) {
  return (
    <section className="output-panel">
      <div className="stdin">
        <div className="panel-title">Input (stdin)</div>
        <textarea value={stdin} spellCheck={false} placeholder="Text passed to your program's standard input" onChange={(e) => onStdinChange(e.target.value)} />
      </div>
      <div className="output">
        <div className="panel-title">
          Output
          {run.fileName && (
            <span className="muted">
              {' '}· {run.fileName} {run.running ? 'started' : 'run'} by {run.userName}
            </span>
          )}
        </div>
        <div className="output-body">
          {run.running && <pre className="out-muted">{'Running…'}</pre>}
          {!run.running && run.result && <Result result={run.result} />}
          {!run.running && !run.result && <pre className="out-muted">Press Run or Ctrl+Enter. Everyone in the room sees the output.</pre>}
        </div>
      </div>
    </section>
  );
}
