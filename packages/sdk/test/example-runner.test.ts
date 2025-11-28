import { describe, expect, it } from 'bun:test';
import type { SpecExport } from '@openpkg-ts/spec';
import {
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  hasNonAssertionComments,
  parseAssertions,
} from '../src/analysis/docs-coverage';
import type { ExampleRunResult } from '../src/utils/example-runner';
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

describe('parseAssertions', () => {
  it('extracts single assertion', () => {
    const assertions = parseAssertions('console.log(1 + 2); // => 3');
    expect(assertions).toHaveLength(1);
    expect(assertions[0]).toEqual({ lineNumber: 1, expected: '3' });
  });

  it('extracts multiple assertions', () => {
    const code = `console.log(1); // => 1\nconsole.log(2); // => 2`;
    const assertions = parseAssertions(code);
    expect(assertions).toHaveLength(2);
    expect(assertions[0]).toEqual({ lineNumber: 1, expected: '1' });
    expect(assertions[1]).toEqual({ lineNumber: 2, expected: '2' });
  });

  it('ignores lines without assertions', () => {
    const code = `const x = 1;\nconsole.log(x); // => 1\nconst y = 2;`;
    const assertions = parseAssertions(code);
    expect(assertions).toHaveLength(1);
    expect(assertions[0].lineNumber).toBe(2);
  });

  it('handles markdown code blocks', () => {
    const code = '```ts\nconsole.log(1); // => 1\n```';
    const assertions = parseAssertions(code);
    expect(assertions).toHaveLength(1);
    expect(assertions[0].expected).toBe('1');
  });

  it('returns empty for no assertions', () => {
    const assertions = parseAssertions('console.log(1);');
    expect(assertions).toHaveLength(0);
  });

  it('handles string assertions', () => {
    const assertions = parseAssertions('console.log("hello"); // => hello');
    expect(assertions[0].expected).toBe('hello');
  });

  it('handles JSON-like assertions', () => {
    const assertions = parseAssertions('console.log({a: 1}); // => { a: 1 }');
    expect(assertions[0].expected).toBe('{ a: 1 }');
  });

  it('handles array assertions', () => {
    const assertions = parseAssertions('console.log([1, 2, 3]); // => [1, 2, 3]');
    expect(assertions[0].expected).toBe('[1, 2, 3]');
  });

  it('trims whitespace from expected value', () => {
    const assertions = parseAssertions('console.log(1); // =>    42   ');
    expect(assertions[0].expected).toBe('42');
  });

  it('handles assertions with extra spaces after =>', () => {
    const assertions = parseAssertions('console.log(1); // =>   hello world  ');
    expect(assertions[0].expected).toBe('hello world');
  });
});

describe('hasNonAssertionComments', () => {
  it('returns true for regular comments', () => {
    expect(hasNonAssertionComments('// this is a comment')).toBe(true);
    expect(hasNonAssertionComments('console.log(1); // some comment')).toBe(true);
  });

  it('returns false for assertion-only comments', () => {
    expect(hasNonAssertionComments('console.log(1); // => 1')).toBe(false);
  });

  it('returns true when both assertion and non-assertion comments exist', () => {
    expect(hasNonAssertionComments('// setup\nconsole.log(1); // => 1')).toBe(true);
  });

  it('returns false for code without comments', () => {
    expect(hasNonAssertionComments('console.log(1);')).toBe(false);
  });
});

describe('detectExampleAssertionFailures', () => {
  const makeEntry = (examples: string[]): SpecExport => ({
    id: 'test',
    name: 'test',
    kind: 'function',
    examples,
  });

  const makeResult = (stdout: string, success = true): ExampleRunResult => ({
    success,
    stdout,
    stderr: '',
    exitCode: success ? 0 : 1,
    duration: 50,
  });

  it('returns empty when no assertions', () => {
    const entry = makeEntry(['console.log(1);']);
    const results = new Map([[0, makeResult('1\n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('passes when assertion matches', () => {
    const entry = makeEntry(['console.log(1 + 2); // => 3']);
    const results = new Map([[0, makeResult('3\n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('fails when assertion mismatches', () => {
    const entry = makeEntry(['console.log(1 + 2); // => 4']);
    const results = new Map([[0, makeResult('3\n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].type).toBe('example-assertion-failed');
    expect(drifts[0].issue).toContain('expected "4"');
    expect(drifts[0].issue).toContain('got "3"');
  });

  it('fails when output is missing', () => {
    const entry = makeEntry(['console.log(1); // => 1']);
    const results = new Map([[0, makeResult('')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].issue).toContain('no output');
  });

  it('skips failed examples (runtime errors)', () => {
    const entry = makeEntry(['console.log(x); // => 1']);
    const results = new Map([[0, makeResult('', false)]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('handles whitespace normalization', () => {
    const entry = makeEntry(['console.log("hello"); // =>   hello  ']);
    const results = new Map([[0, makeResult('  hello  \n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('handles multiple assertions in one example', () => {
    const code = `console.log(1); // => 1\nconsole.log(2); // => 2`;
    const entry = makeEntry([code]);
    const results = new Map([[0, makeResult('1\n2\n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('reports correct line number for failures', () => {
    const code = `const x = 5;\nconsole.log(x); // => 10`;
    const entry = makeEntry([code]);
    const results = new Map([[0, makeResult('5\n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].target).toBe('example[0]:line2');
  });

  it('provides helpful suggestion with actual value', () => {
    const entry = makeEntry(['console.log(1 + 2); // => 4']);
    const results = new Map([[0, makeResult('3\n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts[0].suggestion).toBe('Update assertion to: // => 3');
  });

  it('handles examples without any examples array', () => {
    const entry: SpecExport = { id: 'test', name: 'test', kind: 'function' };
    const results = new Map([[0, makeResult('1\n')]]);
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(0);
  });

  it('handles empty runtime results map', () => {
    const entry = makeEntry(['console.log(1); // => 1']);
    const results = new Map<number, ExampleRunResult>();
    const drifts = detectExampleAssertionFailures(entry, results);
    expect(drifts).toHaveLength(0);
  });
});
