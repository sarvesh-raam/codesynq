import { languageForFile } from '@codesynq/shared';
import { config } from './config.js';

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
export async function getRuntimes() {
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

/**
 * Runs `mainFile` with the other room files available next to it.
 * @param {{ name: string, content: string }} mainFile
 * @param {Array<{ name: string, content: string }>} otherFiles
 * @param {string} stdin
 */
export async function execute(mainFile, otherFiles, stdin = '') {
  const lang = languageForFile(mainFile.name);
  if (!lang.piston) throw new Error(`${lang.label} files cannot be executed`);
  const runtime = await resolveRuntime(lang.piston);

  const started = Date.now();
  const result = await pistonRequest('/execute', {
    method: 'POST',
    body: JSON.stringify({
      language: runtime.language,
      version: runtime.version,
      // Piston runs the first file; the rest are written alongside it.
      files: [mainFile, ...otherFiles].map(({ name, content }) => ({ name, content })),
      stdin: String(stdin).slice(0, 100_000),
    }),
  });

  const trim = (s) => (typeof s === 'string' ? s.slice(0, 64_000) : '');
  return {
    language: lang.label,
    version: result.version ?? runtime.version,
    compile: result.compile
      ? { output: trim(result.compile.output), code: result.compile.code, signal: result.compile.signal }
      : null,
    run: {
      stdout: trim(result.run?.stdout),
      stderr: trim(result.run?.stderr),
      code: result.run?.code ?? null,
      signal: result.run?.signal ?? null,
    },
    durationMs: Date.now() - started,
  };
}
