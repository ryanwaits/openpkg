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

    registerGenerateCommand(program, {
      createOpenPkg: () => ({
        analyzeFile: async (file: string) => {
          analyzedFiles.push(file);
          return { exports: [], types: [] } as any;
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
  });
});
