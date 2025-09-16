import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { registerAnalyzeCommand } from '../src/commands/analyze';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('analyze command', () => {
  it('writes spec output using remote analysis result', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-analyze-'));
    tmpDirs.push(tmpDir);

    const program = new Command();
    program.exitOverride();

    const specOutput = path.join(tmpDir, 'remote-spec.json');

    registerAnalyzeCommand(program, {
      analyzeRemote: async () => ({
        metadata: {
          filesAnalyzed: 1,
          duration: 5,
          cached: false,
        },
        spec: {
          $schema: 'schema',
          openpkg: '0.1.0',
          meta: { name: 'remote', version: '1.0.0', description: '', license: '', repository: '', ecosystem: 'js/ts' },
          exports: [],
          types: [],
        },
      } as any),
      spinner: () =>
        ({
          start() {
            return this;
          },
          succeed() {},
          warn() {},
          fail() {},
        } as unknown as { start: () => unknown; succeed: () => void; warn: () => void; fail: () => void }),
      log: () => {},
      warn: () => {},
      error: () => {},
    });

    await program.parseAsync([
      'node',
      'openpkg',
      'analyze',
      'https://example.com/file.ts',
      '--output',
      specOutput,
      '--show',
      'spec',
    ]);

    expect(fs.existsSync(specOutput)).toBe(true);
    const contents = JSON.parse(fs.readFileSync(specOutput, 'utf-8'));
    expect(contents.openpkg).toBe('0.1.0');
  });
});
