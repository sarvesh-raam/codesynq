import { LANGUAGES, languageForFile } from '@codesynq/shared';
import { config } from './config.js';
import { executeWandbox, getRunnableExtensions as getWandboxExtensions } from './wandbox.js';

const RUNTIMES_TTL_MS = 10 * 60_000;
let runtimesCache = { at: 0, runtimes: null };

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (config.pistonToken) h.Authorization = config.pistonToken;
  return h;
}

async function pistonRequest(path, init = {}) {
  const res = await fetch(`${config.pistonUrl}${path}`, {
    ...init,
    headers: headers(),
    signal: AbortSignal.timeout(config.runTimeoutMs + 5_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Execution service responded with ${res.status}`);
  return body;
}

/** @returns {Promise<Array<{ language: string, version: string, aliases: string[] }>>} */
async function getRuntimes() {
  if (runtimesCache.runtimes && Date.now() - runtimesCache.at < RUNTIMES_TTL_MS) return runtimesCache.runtimes;
  const runtimes = await pistonRequest('/runtimes');
  runtimesCache = { at: Date.now(), runtimes };
  return runtimes;
}

async function resolveRuntime(pistonLanguage) {
  const runtimes = await getRuntimes();
  const matches = runtimes.filter((r) => r.language === pistonLanguage || r.aliases?.includes(pistonLanguage));
  if (!matches.length) throw new Error(`No runtime installed for ${pistonLanguage}`);
  // Prefer the newest installed version.
  return matches.sort((a, b) => compareVersions(b.version, a.version))[0];
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

async function executePiston(lang, mainFile, otherFiles, stdin) {
  const runtime = await resolveRuntime(lang.piston);
  const result = await pistonRequest('/execute', {
    method: 'POST',
    body: JSON.stringify({
      language: runtime.language,
      version: runtime.version,
      // Piston runs the first file; the rest are written alongside it.
      files: [mainFile, ...otherFiles].map(({ name, content }) => ({ name, content })),
      stdin,
    }),
  });
  return {
    version: result.version ?? runtime.version,
    compile: result.compile
      ? { output: result.compile.output, code: result.compile.code, signal: result.compile.signal }
      : null,
    run: {
      stdout: result.run?.stdout,
      stderr: result.run?.stderr,
      code: result.run?.code ?? null,
      signal: result.run?.signal ?? null,
    },
  };
}

/** File extensions the configured execution service can run. */
export async function getRunnableExtensions() {
  if (config.executor === 'wandbox') return getWandboxExtensions();
  const runtimes = await getRuntimes();
  const installed = new Set(runtimes.flatMap((r) => [r.language, ...(r.aliases ?? [])]));
  return LANGUAGES.filter((l) => l.piston && installed.has(l.piston)).map((l) => l.ext);
}

/**
 * Runs `mainFile` with the other room files available next to it.
 * @param {{ name: string, content: string }} mainFile
 * @param {Array<{ name: string, content: string }>} otherFiles
 * @param {string} stdin
 */
export async function execute(mainFile, otherFiles, stdin = '') {
  const lang = languageForFile(mainFile.name);
  if (!lang.piston) throw new Error(`${lang.label} files cannot be executed`);
  const files = otherFiles.map(({ name, content }) => ({ name, content }));
  const input = String(stdin).slice(0, 100_000);

  const started = Date.now();
  const run = config.executor === 'wandbox' ? executeWandbox : executePiston;
  const result = await run(lang, { name: mainFile.name, content: mainFile.content }, files, input);

  const trim = (s) => (typeof s === 'string' ? s.slice(0, 64_000) : '');
  return {
    language: lang.label,
    version: result.version,
    compile: result.compile ? { ...result.compile, output: trim(result.compile.output) } : null,
    run: { ...result.run, stdout: trim(result.run.stdout), stderr: trim(result.run.stderr) },
    durationMs: Date.now() - started,
  };
}
