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
  it('analyzes a local file and writes spec when requested', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-analyze-'));
    tmpDirs.push(tmpDir);

    const entryPath = path.join(tmpDir, 'entry.ts');
    fs.writeFileSync(entryPath, 'export const value = 1;');

    const program = new Command();
    program.exitOverride();

    const specOutput = path.join(tmpDir, 'spec.json');
    const analyzedFiles: string[] = [];

    let capturedOptions: unknown = undefined;

    registerAnalyzeCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async (file: string, options?: unknown) => {
          analyzedFiles.push(file);
          capturedOptions = options;
          return {
            spec: {
              $schema: 'schema',
              openpkg: '0.1.0',
              meta: {
                name: 'local',
                version: '1.0.0',
                description: '',
                license: '',
                repository: '',
                ecosystem: 'js/ts',
              },
              exports: [],
              types: [],
            },
            diagnostics: [],
            metadata: {
              baseDir: path.dirname(file),
              configPath: undefined,
              packageJsonPath: undefined,
              hasNodeModules: true,
              resolveExternalTypes: true,
            },
          } as any;
        },
      }),
      spinner: () =>
        ({
          start() {
            return this;
          },
          succeed() {},
          fail() {},
        } as unknown as { start: () => unknown; succeed: () => void; fail: () => void }),
      log: () => {},
      error: () => {},
    });

    await program.parseAsync([
      'node',
      'openpkg',
      'analyze',
      'entry.ts',
      '--cwd',
      tmpDir,
      '--output',
      specOutput,
      '--show',
      'spec',
    ]);

    expect(analyzedFiles).toEqual([path.resolve(tmpDir, 'entry.ts')]);
    expect(fs.existsSync(specOutput)).toBe(true);
    const contents = JSON.parse(fs.readFileSync(specOutput, 'utf-8'));
    expect(contents.openpkg).toBe('0.1.0');
    expect(capturedOptions).toBeUndefined();
  });

  it('passes include filters from CLI flags', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-analyze-filter-'));
    tmpDirs.push(tmpDir);

    const entryPath = path.join(tmpDir, 'entry.ts');
    fs.writeFileSync(entryPath, 'export const value = 1;');

    const program = new Command();
    program.exitOverride();

    let capturedFilters: unknown = undefined;

    registerAnalyzeCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async (_file: string, options?: { filters?: unknown }) => {
          capturedFilters = options?.filters;
          return {
            spec: {
              openpkg: '0.1.0',
              meta: {
                name: 'local',
                version: '1.0.0',
                description: '',
                license: '',
                repository: '',
                ecosystem: 'js/ts',
              },
              exports: [],
              types: [],
            },
            diagnostics: [],
            metadata: {
              baseDir: tmpDir,
              configPath: undefined,
              packageJsonPath: undefined,
              hasNodeModules: true,
              resolveExternalTypes: true,
            },
          };
        },
      }),
      spinner: () =>
        ({
          start() {
            return this;
          },
          succeed() {},
          fail() {},
        } as unknown as { start: () => unknown; succeed: () => void; fail: () => void }),
      log: () => {},
      error: () => {},
    });

    await program.parseAsync([
      'node',
      'openpkg',
      'analyze',
      'entry.ts',
      '--cwd',
      tmpDir,
      '--include',
      'alpha',
      '--exclude',
      'beta',
    ]);

    expect(capturedFilters).toEqual({ include: ['alpha'], exclude: ['beta'] });
  });
});
