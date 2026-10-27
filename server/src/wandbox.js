import { LANGUAGES } from '@codesynq/shared';
import { config } from './config.js';

// Wandbox (https://wandbox.org) is a free public compiler service that needs
// no API key. This maps our Piston language names to Wandbox language names
// for the languages it can run.
const WANDBOX_LANGUAGES = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  c: 'C',
  'c++': 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  scala: 'Scala',
  rscript: 'R',
  perl: 'Perl',
  lua: 'Lua',
  haskell: 'Haskell',
  bash: 'Bash script',
  elixir: 'Elixir',
  erlang: 'Erlang',
  julia: 'Julia',
  nim: 'Nim',
  crystal: 'Crystal',
  d: 'D',
  zig: 'Zig',
  pascal: 'Pascal',
  groovy: 'Groovy',
  ocaml: 'OCaml',
  lisp: 'Lisp',
  sqlite3: 'SQL',
};

const COMPILERS_TTL_MS = 60 * 60_000;
let compilersCache = { at: 0, compilers: null };

async function wandboxRequest(path, init = {}) {
  const res = await fetch(`${config.wandboxUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(config.wandboxTimeoutMs),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`Execution service responded with ${res.status}`);
  return body;
}

/** @returns {Promise<Array<{ name: string, version: string, language: string }>>} */
async function getCompilers() {
  if (compilersCache.compilers && Date.now() - compilersCache.at < COMPILERS_TTL_MS) return compilersCache.compilers;
  const compilers = await wandboxRequest('/list.json');
  compilersCache = { at: Date.now(), compilers };
  return compilers;
}

// Wandbox lists the newest compiler first; skip unreleased "head" builds.
function pickCompiler(compilers, language) {
  return compilers.find((c) => c.language === language && !c.name.includes('head') && c.version);
}

export async function getRunnableExtensions() {
  const compilers = await getCompilers();
  return LANGUAGES.filter((l) => l.piston && pickCompiler(compilers, WANDBOX_LANGUAGES[l.piston])).map((l) => l.ext);
}

// Wandbox always saves the main file as prog.<ext>, so javac rejects a public
// class named after the real file. Dropping `public` keeps it compilable.
function adaptMainSource(lang, name, content) {
  if (lang.piston !== 'java') return content;
  const className = name.replace(/\.java$/, '');
  return content.replace(new RegExp(`\\bpublic\\s+((?:final\\s+|abstract\\s+)*class\\s+${className}\\b)`), '$1');
}

/**
 * @param {{ label: string, piston: string }} lang
 * @param {{ name: string, content: string }} mainFile
 * @param {Array<{ name: string, content: string }>} otherFiles
 * @param {string} stdin
 */
export async function executeWandbox(lang, mainFile, otherFiles, stdin) {
  const compiler = pickCompiler(await getCompilers(), WANDBOX_LANGUAGES[lang.piston]);
  if (!compiler) throw new Error(`${lang.label} is not available on the execution service`);

  const result = await wandboxRequest('/compile.json', {
    method: 'POST',
    body: JSON.stringify({
      compiler: compiler.name,
      code: adaptMainSource(lang, mainFile.name, mainFile.content),
      codes: otherFiles.map(({ name, content }) => ({ file: name, code: content })),
      stdin,
    }),
  });

  const code = result.status === undefined || result.status === '' ? null : Number(result.status);
  // Wandbox reports one status; if the program produced nothing and the
  // compiler complained, the status belongs to the failed compile.
  const compileFailed = code !== 0 && result.compiler_error && !result.program_message;
  return {
    version: compiler.version,
    compile: result.compiler_message ? { output: result.compiler_message, code: compileFailed ? code : 0, signal: null } : null,
    run: compileFailed
      ? { stdout: '', stderr: '', code: null, signal: null }
      : { stdout: result.program_output ?? '', stderr: result.program_error ?? '', code, signal: result.signal || null },
  };
}
