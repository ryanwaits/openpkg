import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { registerInitCommand } from '../src/commands/init';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  process.exitCode = 0;
});

describe('init command', () => {
  it('creates doccov.config.mjs by default', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-cli-init-default-'));
    tmpDirs.push(tmpDir);

    const program = new Command();
    registerInitCommand(program);

    await program.parseAsync(['node', 'doccov', 'init', '--cwd', tmpDir]);

    const configPath = path.join(tmpDir, 'doccov.config.mjs');
    expect(fs.existsSync(configPath)).toBe(true);

    const contents = fs.readFileSync(configPath, 'utf8');
    expect(contents).toBe(
      [
        "import { defineConfig } from '@doccov/cli/config';",
        '',
        'export default defineConfig({',
        '  include: [],',
        '  exclude: [],',
        '});',
        '',
      ].join('\n'),
    );
  });

  it('creates doccov.config.js when package type is module', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-cli-init-module-'));
    tmpDirs.push(tmpDir);

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'fixture', type: 'module' }),
    );

    const program = new Command();
    registerInitCommand(program);

    await program.parseAsync(['node', 'doccov', 'init', '--cwd', tmpDir]);

    const configPath = path.join(tmpDir, 'doccov.config.js');
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('fails when a config file already exists in the tree', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doccov-cli-init-existing-'));
    tmpDirs.push(tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'doccov.config.mjs'), 'export default {};\n');

    const errors: string[] = [];
    const program = new Command();

    registerInitCommand(program, {
      error: (message) => {
        errors.push(String(message));
      },
    });

    await program.parseAsync(['node', 'doccov', 'init', '--cwd', tmpDir]);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('config already exists');
    expect(process.exitCode).toBe(1);
  });
});
