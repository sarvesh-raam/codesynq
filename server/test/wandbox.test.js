import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { languageForFile } from '@codesynq/shared';
import { executeWandbox, getRunnableExtensions } from '../src/wandbox.js';

// A stand-in for the Wandbox API: answers list.json and records compile requests.
const COMPILERS = [
  { name: 'cpython-head', version: '', language: 'Python' },
  { name: 'cpython-3.14.0', version: '3.14.0', language: 'Python' },
  { name: 'openjdk-jdk-22+36', version: 'jdk-22+36', language: 'Java' },
  { name: 'gcc-13.2.0-c', version: '13.2.0', language: 'C' },
];
let requests;
let nextResult;
const realFetch = globalThis.fetch;

beforeEach(() => {
  requests = [];
  globalThis.fetch = async (url, init = {}) => {
    const body = url.endsWith('/list.json') ? COMPILERS : nextResult;
    if (init.body) requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify(body), { status: 200 });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('lists extensions for languages Wandbox offers', async () => {
  const runnable = await getRunnableExtensions();
  assert.deepEqual(runnable.sort(), ['c', 'java', 'py']);
});

test('runs with the newest released compiler and passes files and stdin', async () => {
  nextResult = { status: '0', compiler_message: '', program_output: 'hi\n', program_error: '', program_message: 'hi\n' };
  const result = await executeWandbox(
    languageForFile('main.py'),
    { name: 'main.py', content: 'print(input())' },
    [{ name: 'util.py', content: 'x = 1' }],
    'hi',
  );
  assert.deepEqual(requests[0], {
    compiler: 'cpython-3.14.0',
    code: 'print(input())',
    codes: [{ file: 'util.py', code: 'x = 1' }],
    stdin: 'hi',
  });
  assert.equal(result.version, '3.14.0');
  assert.equal(result.compile, null);
  assert.deepEqual(result.run, { stdout: 'hi\n', stderr: '', code: 0, signal: null });
});

test('drops `public` from the main Java class so it compiles as prog.java', async () => {
  nextResult = { status: '0', program_output: 'ok\n', program_message: 'ok\n' };
  await executeWandbox(languageForFile('Main.java'), { name: 'Main.java', content: 'public final class Main {}\npublic class Other {}' }, [], '');
  assert.equal(requests[0].code, 'final class Main {}\npublic class Other {}');
});

test('reports a failed compile separately from the run', async () => {
  nextResult = { status: '1', compiler_error: 'error: oops\n', compiler_message: 'error: oops\n', program_message: '' };
  const result = await executeWandbox(languageForFile('main.c'), { name: 'main.c', content: 'oops' }, [], '');
  assert.deepEqual(result.compile, { output: 'error: oops\n', code: 1, signal: null });
  assert.equal(result.run.code, null);
});
