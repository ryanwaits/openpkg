import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { registerGenerateCommand } from '../src/commands/generate';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('generate command', () => {
  it('uses auto-detected entry point and writes spec to output', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-generate-'));
    tmpDirs.push(tmpDir);

    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), "export const value = 1 as const;\n");
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'fixture' }));

    const analyzedFiles: string[] = [];

    const program = new Command();
    program.exitOverride();

    let capturedOptions: unknown = undefined;

    const specStub = {
      openpkg: '0.1.0',
      meta: {
        name: 'fixture',
        version: '1.0.0',
        description: '',
        license: '',
        repository: '',
        ecosystem: 'js/ts',
      },
      exports: [],
      types: [],
    };

    registerGenerateCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async (file: string, options?: unknown) => {
          analyzedFiles.push(file);
          capturedOptions = options;
          return {
            spec: specStub,
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
      writeFileSync: (file, data) => {
        fs.writeFileSync(file, data);
      },
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

    const outputPath = path.join(tmpDir, 'spec.json');

    await program.parseAsync([
      'node',
      'openpkg',
      'generate',
      '--cwd',
      tmpDir,
      '--output',
      outputPath,
    ]);

    expect(analyzedFiles).toEqual([path.join(tmpDir, 'src', 'index.ts')]);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(capturedOptions).toEqual({});
  });

  it('merges include/exclude filters from config and CLI flags', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-cli-generate-filter-'));
    tmpDirs.push(tmpDir);

    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), "export const value = 1 as const;\n");
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'fixture' }));
    fs.writeFileSync(
      path.join(tmpDir, 'openpkg.config.mjs'),
      'export default { include: ["alpha", "beta"], exclude: ["gamma"] };\n',
    );

    const program = new Command();
    program.exitOverride();

    let capturedFilters: unknown = undefined;

    registerGenerateCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async (_file: string, options?: { filters?: unknown }) => {
          capturedFilters = options?.filters;
          return {
            spec: {
              openpkg: '0.1.0',
              meta: {
                name: 'fixture',
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
      writeFileSync: () => {},
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
      'generate',
      '--cwd',
      tmpDir,
      '--include',
      'alpha',
      '--exclude',
      'delta',
    ]);

    expect(capturedFilters).toEqual({ include: ['alpha'], exclude: ['gamma', 'delta'] });
  });
});
