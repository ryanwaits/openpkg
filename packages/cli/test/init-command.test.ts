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
  it('creates openpkg.config.mjs by default', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-ts-cli-init-default-'));
    tmpDirs.push(tmpDir);

    const program = new Command();
    registerInitCommand(program);

    await program.parseAsync(['node', 'openpkg', 'init', '--cwd', tmpDir]);

    const configPath = path.join(tmpDir, 'openpkg.config.mjs');
    expect(fs.existsSync(configPath)).toBe(true);

    const contents = fs.readFileSync(configPath, 'utf8');
    expect(contents).toBe(
      [
        "import { defineConfig } from '@openpkg-ts/cli/config';",
        '',
        'export default defineConfig({',
        '  include: [],',
        '  exclude: [],',
        '});',
        '',
      ].join('\n'),
    );
  });

  it('creates openpkg.config.js when package type is module', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-ts-cli-init-module-'));
    tmpDirs.push(tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module' }));

    const program = new Command();
    registerInitCommand(program);

    await program.parseAsync(['node', 'openpkg', 'init', '--cwd', tmpDir]);

    const configPath = path.join(tmpDir, 'openpkg.config.js');
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('fails when a config file already exists in the tree', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpkg-ts-cli-init-existing-'));
    tmpDirs.push(tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'openpkg.config.mjs'), 'export default {};\n');

    const errors: string[] = [];
    const program = new Command();

    registerInitCommand(program, {
      error: (message) => {
        errors.push(String(message));
      },
    });

    await program.parseAsync(['node', 'openpkg', 'init', '--cwd', tmpDir]);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('config already exists');
    expect(process.exitCode).toBe(1);
  });
});
