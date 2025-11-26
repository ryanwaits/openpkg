import { describe, expect, it } from 'bun:test';
import type { SpecExport } from '@openpkg-ts/spec';
import { detectExampleRuntimeErrors } from '../src/analysis/docs-coverage';
import { runExample, runExamples } from '../src/utils/example-runner';

describe('runExample', () => {
  it('runs simple sync code successfully', async () => {
    const code = 'console.log("hello");';
    const result = await runExample(code);

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    // Note: stderr may contain Node's experimental warning for --experimental-strip-types
  });

  it('runs code with arithmetic', async () => {
    const code = 'console.log(2 + 3);';
    const result = await runExample(code);

    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('5');
  });

  it('handles async/await code', async () => {
    const code = `
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      await delay(10);
      console.log("done");
    `;
    const result = await runExample(code);

    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('done');
  });

  it('strips markdown code block markers', async () => {
    const code = '```ts\nconsole.log("stripped");\n```';
    const result = await runExample(code);

    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('stripped');
  });

  it('detects ReferenceError', async () => {
    const code = 'console.log(undefinedVariable);';
    const result = await runExample(code);

    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('undefinedVariable');
  });

  it('detects TypeError', async () => {
    const code = 'const x = null; console.log(x.foo);';
    const result = await runExample(code);

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/TypeError|Cannot read/);
  });

  it('respects timeout option', async () => {
    const code = 'while(true) {}';
    const result = await runExample(code, { timeout: 100 });

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('timed out');
  }, 5000);

  it('tracks duration', async () => {
    const code = 'console.log("quick");';
    const result = await runExample(code);

    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThan(5000);
  });
});

describe('runExamples', () => {
  it('runs multiple examples', async () => {
    const examples = ['console.log(1);', 'console.log(2);', 'console.log(3);'];
    const results = await runExamples(examples);

    expect(results.size).toBe(3);
    expect(results.get(0)?.success).toBe(true);
    expect(results.get(1)?.success).toBe(true);
    expect(results.get(2)?.success).toBe(true);
  });

  it('skips empty examples', async () => {
    const examples = ['console.log(1);', '', '   ', 'console.log(2);'];
    const results = await runExamples(examples);

    expect(results.size).toBe(2);
    expect(results.has(0)).toBe(true);
    expect(results.has(1)).toBe(false);
    expect(results.has(2)).toBe(false);
    expect(results.has(3)).toBe(true);
  });
});

describe('detectExampleRuntimeErrors', () => {
  it('returns empty array when no runtime results', () => {
    const entry: SpecExport = {
      id: 'test',
      name: 'test',
      kind: 'function',
      examples: ['console.log("test");'],
    };
    const results = new Map();

    const drifts = detectExampleRuntimeErrors(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('returns empty array when all examples pass', () => {
    const entry: SpecExport = {
      id: 'test',
      name: 'test',
      kind: 'function',
      examples: ['console.log("test");'],
    };
    const results = new Map([
      [0, { success: true, stdout: 'test', stderr: '', exitCode: 0, duration: 100 }],
    ]);

    const drifts = detectExampleRuntimeErrors(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('detects runtime error drift', () => {
    const entry: SpecExport = {
      id: 'test',
      name: 'test',
      kind: 'function',
      examples: ['console.log(undefined);'],
    };
    const results = new Map([
      [
        0,
        {
          success: false,
          stdout: '',
          stderr: 'ReferenceError: x is not defined',
          exitCode: 1,
          duration: 100,
        },
      ],
    ]);

    const drifts = detectExampleRuntimeErrors(entry, results);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].type).toBe('example-runtime-error');
    expect(drifts[0].target).toBe('example[0]');
    expect(drifts[0].issue).toContain('throws at runtime');
  });

  it('detects timeout drift', () => {
    const entry: SpecExport = {
      id: 'test',
      name: 'test',
      kind: 'function',
      examples: ['while(true) {}'],
    };
    const results = new Map([
      [
        0,
        {
          success: false,
          stdout: '',
          stderr: 'Example timed out after 5000ms',
          exitCode: 1,
          duration: 5000,
        },
      ],
    ]);

    const drifts = detectExampleRuntimeErrors(entry, results);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].type).toBe('example-runtime-error');
    expect(drifts[0].issue).toContain('timed out');
    expect(drifts[0].suggestion).toContain('infinite loops');
  });

  it('handles multiple examples with mixed results', () => {
    const entry: SpecExport = {
      id: 'test',
      name: 'test',
      kind: 'function',
      examples: ['console.log(1);', 'throw new Error("fail");', 'console.log(3);'],
    };
    const results = new Map([
      [0, { success: true, stdout: '1', stderr: '', exitCode: 0, duration: 50 }],
      [1, { success: false, stdout: '', stderr: 'Error: fail', exitCode: 1, duration: 50 }],
      [2, { success: true, stdout: '3', stderr: '', exitCode: 0, duration: 50 }],
    ]);

    const drifts = detectExampleRuntimeErrors(entry, results);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].target).toBe('example[1]');
  });
});
