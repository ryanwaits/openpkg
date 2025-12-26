import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { registerGenerateCommand } from './generate';

const testOutDir = path.join(import.meta.dir, '../../.test-output');
const sampleSpecPath = path.join(import.meta.dir, '../../examples/sample-spec.json');

describe('generate command', () => {
  beforeAll(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up after tests
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true });
    }
  });

  test('registerGenerateCommand adds generate command', () => {
    const program = new Command();
    registerGenerateCommand(program);

    const generateCmd = program.commands.find((c) => c.name() === 'generate');
    expect(generateCmd).toBeDefined();
    expect(generateCmd?.description()).toContain('Generate MDX or JSON');
  });

  test('generates MDX files', async () => {
    const outDir = path.join(testOutDir, 'mdx-test');
    const program = new Command();
    program.exitOverride(); // Prevent process.exit
    registerGenerateCommand(program);

    await program.parseAsync(['node', 'test', 'generate', sampleSpecPath, '-o', outDir]);

    // Check output directory exists
    expect(fs.existsSync(outDir)).toBe(true);

    // Check MDX files created (grouped by kind)
    expect(fs.existsSync(path.join(outDir, 'functions'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'functions', 'greet.mdx'))).toBe(true);
  });

  test('generates JSON file', async () => {
    const outDir = path.join(testOutDir, 'json-test');
    const program = new Command();
    program.exitOverride();
    registerGenerateCommand(program);

    await program.parseAsync([
      'node',
      'test',
      'generate',
      sampleSpecPath,
      '-o',
      outDir,
      '-f',
      'json',
    ]);

    expect(fs.existsSync(path.join(outDir, 'api.json'))).toBe(true);

    const content = fs.readFileSync(path.join(outDir, 'api.json'), 'utf-8');
    const json = JSON.parse(content);
    expect(json.name).toBe('my-library');
  });

  test('generates flat structure', async () => {
    const outDir = path.join(testOutDir, 'flat-test');
    const program = new Command();
    program.exitOverride();
    registerGenerateCommand(program);

    await program.parseAsync(['node', 'test', 'generate', sampleSpecPath, '-o', outDir, '--flat']);

    // Files should be at root level, not in kind folders
    expect(fs.existsSync(path.join(outDir, 'greet.mdx'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'functions'))).toBe(false);
  });

  test('generates fumadocs navigation', async () => {
    const outDir = path.join(testOutDir, 'nav-fumadocs');
    const program = new Command();
    program.exitOverride();
    registerGenerateCommand(program);

    await program.parseAsync([
      'node',
      'test',
      'generate',
      sampleSpecPath,
      '-o',
      outDir,
      '--nav',
      'fumadocs',
    ]);

    expect(fs.existsSync(path.join(outDir, 'meta.json'))).toBe(true);

    const content = fs.readFileSync(path.join(outDir, 'meta.json'), 'utf-8');
    const meta = JSON.parse(content);
    expect(meta.root).toBe(true);
  });

  test('generates docusaurus navigation', async () => {
    const outDir = path.join(testOutDir, 'nav-docusaurus');
    const program = new Command();
    program.exitOverride();
    registerGenerateCommand(program);

    await program.parseAsync([
      'node',
      'test',
      'generate',
      sampleSpecPath,
      '-o',
      outDir,
      '--nav',
      'docusaurus',
    ]);

    expect(fs.existsSync(path.join(outDir, 'sidebars.js'))).toBe(true);

    const content = fs.readFileSync(path.join(outDir, 'sidebars.js'), 'utf-8');
    expect(content).toContain('module.exports =');
  });

  test('generates generic navigation', async () => {
    const outDir = path.join(testOutDir, 'nav-generic');
    const program = new Command();
    program.exitOverride();
    registerGenerateCommand(program);

    await program.parseAsync([
      'node',
      'test',
      'generate',
      sampleSpecPath,
      '-o',
      outDir,
      '--nav',
      'generic',
    ]);

    expect(fs.existsSync(path.join(outDir, 'nav.json'))).toBe(true);
  });

  test('respects base-path option', async () => {
    const outDir = path.join(testOutDir, 'base-path');
    const program = new Command();
    program.exitOverride();
    registerGenerateCommand(program);

    await program.parseAsync([
      'node',
      'test',
      'generate',
      sampleSpecPath,
      '-o',
      outDir,
      '--nav',
      'generic',
      '--base-path',
      '/docs/api',
    ]);

    const content = fs.readFileSync(path.join(outDir, 'nav.json'), 'utf-8');
    const nav = JSON.parse(content);
    expect(nav.groups[0].items[0].href).toContain('/docs/api/');
  });
});
