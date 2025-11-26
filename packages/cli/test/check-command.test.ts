import { describe, expect, it } from 'bun:test';
import { Command } from 'commander';
import { registerCheckCommand } from '../src/commands/check';

const spinnerStub = () =>
  ({
    start() {
      return this;
    },
    succeed() {},
    fail() {},
  }) as any;

type DriftType =
  | 'param-mismatch'
  | 'param-type-mismatch'
  | 'return-type-mismatch'
  | 'generic-constraint-mismatch'
  | 'optionality-mismatch'
  | 'deprecated-mismatch'
  | 'visibility-mismatch';
type ExportMissingInput = { name: string; missing?: string[]; score?: number };
type ExportDriftInput = { name: string; issue: string; suggestion?: string; type?: DriftType };

function createSpec({
  coverage,
  exportMissing = [],
  exportDrift = [],
}: {
  coverage: number;
  exportMissing?: ExportMissingInput[];
  exportDrift?: ExportDriftInput[];
}) {
  type ExportMeta = {
    missing?: string[];
    score?: number;
    drift?: Array<{
      type: DriftType;
      issue: string;
      suggestion?: string;
    }>;
  };

  const exportMap = new Map<string, ExportMeta>();

  for (const item of exportMissing) {
    exportMap.set(item.name, {
      missing: item.missing,
      score: item.score,
    });
  }

  for (const drift of exportDrift) {
    const meta = exportMap.get(drift.name) ?? {};
    if (!meta.drift) {
      meta.drift = [];
    }
    meta.drift.push({
      type: drift.type ?? 'param-mismatch',
      issue: drift.issue,
      suggestion: drift.suggestion,
    });
    exportMap.set(drift.name, meta);
  }

  const exports = Array.from(exportMap.entries()).map(([name, meta], index) => ({
    id: `${index}`,
    name,
    kind: 'function',
    signatures: [],
    docs: {
      coverageScore: meta.score ?? coverage,
      missing: meta.missing,
      drift: meta.drift,
    },
  }));

  return {
    spec: {
      openpkg: '0.2.0',
      meta: {
        name: 'fixture',
      },
      exports,
      docs: {
        coverageScore: coverage,
      },
    },
    diagnostics: [],
    metadata: {
      baseDir: process.cwd(),
      configPath: undefined,
      packageJsonPath: undefined,
      hasNodeModules: true,
      resolveExternalTypes: true,
    },
  };
}

describe('check command', () => {
  it('passes when coverage meets threshold', async () => {
    const program = new Command();
    program.exitOverride();

    const logs: string[] = [];

    registerCheckCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async () => createSpec({ coverage: 92 }),
      }),
      spinner: spinnerStub,
      log: (msg: string) => logs.push(msg),
      error: () => {},
    });

    await program.parseAsync([
      'node',
      'openpkg',
      'check',
      'src/index.ts',
      '--cwd',
      process.cwd(),
      '--min-coverage',
      '90',
    ]);

    expect(logs[0]).toContain('Docs coverage');
  });

  it('fails when coverage drops below min threshold', async () => {
    const program = new Command();
    program.exitOverride();

    const errors: string[] = [];

    registerCheckCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async () =>
          createSpec({
            coverage: 45,
            exportMissing: [{ name: 'alpha', missing: ['description'] }],
          }),
      }),
      spinner: spinnerStub,
      log: () => {},
      error: (msg: string) => errors.push(msg),
    });

    await expect(
      program.parseAsync(['node', 'openpkg', 'check', 'src/index.ts', '--cwd', process.cwd()]),
    ).rejects.toThrow('Documentation coverage requirements not met');

    expect(errors.join('\n')).toContain('Docs coverage 45%');
  });

  it('fails when requiring examples and exports are missing them', async () => {
    const program = new Command();
    program.exitOverride();

    registerCheckCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async () =>
          createSpec({
            coverage: 95,
            exportMissing: [{ name: 'beta', missing: ['examples'] }],
          }),
      }),
      spinner: spinnerStub,
      log: () => {},
      error: () => {},
    });

    await expect(
      program.parseAsync([
        'node',
        'openpkg',
        'check',
        'src/index.ts',
        '--cwd',
        process.cwd(),
        '--require-examples',
      ]),
    ).rejects.toThrow('Documentation coverage requirements not met');
  });

  it('fails when drift signals are reported', async () => {
    const program = new Command();
    program.exitOverride();

    const errors: string[] = [];

    registerCheckCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async () =>
          createSpec({
            coverage: 95,
            exportMissing: [{ name: 'gamma', missing: [] }],
            exportDrift: [
              {
                name: 'gamma',
                issue: 'JSDoc documents parameter "tax" which is not present in the signature.',
                suggestion: 'taxRate',
              },
            ],
          }),
      }),
      spinner: spinnerStub,
      log: () => {},
      error: (msg: string) => errors.push(msg),
    });

    await expect(
      program.parseAsync(['node', 'openpkg', 'check', 'src/index.ts', '--cwd', process.cwd()]),
    ).rejects.toThrow('Documentation coverage requirements not met');

    expect(errors.join('\n')).toContain('Suggestion: taxRate');
  });

  it('fails when param type drift is reported', async () => {
    const program = new Command();
    program.exitOverride();

    const errors: string[] = [];

    registerCheckCommand(program, {
      createOpenPkg: () => ({
        analyzeFileWithDiagnostics: async () =>
          createSpec({
            coverage: 95,
            exportDrift: [
              {
                name: 'delta',
                type: 'param-type-mismatch',
                issue:
                  'JSDoc documents string for parameter "amount" but the signature declares number.',
                suggestion: 'Use number in @param tags.',
              },
            ],
          }),
      }),
      spinner: spinnerStub,
      log: () => {},
      error: (msg: string) => errors.push(msg),
    });

    await expect(
      program.parseAsync(['node', 'openpkg', 'check', 'src/index.ts', '--cwd', process.cwd()]),
    ).rejects.toThrow('Documentation coverage requirements not met');

    expect(errors.join('\n')).toContain(
      'JSDoc documents string for parameter "amount" but the signature declares number.',
    );
  });
});
