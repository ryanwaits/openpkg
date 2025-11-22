import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as TS from 'typescript';
import { ts } from '../ts-module';
import type { AnalysisContextInput } from './context';
import { createAnalysisContext } from './context';
import { buildOpenPkgSpec } from './spec-builder';
import type { OpenPkgSpec } from './spec-types';

export interface AnalysisMetadataInternal {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
}

export interface RunAnalysisResult {
  spec: OpenPkgSpec;
  metadata: AnalysisMetadataInternal;
  diagnostics: readonly TS.Diagnostic[];
}

function findNearestPackageJson(startDir: string): string | undefined {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function hasNodeModulesDirectory(directories: Iterable<string>): boolean {
  for (const dir of directories) {
    let current = dir;
    while (true) {
      const candidate = path.join(current, 'node_modules');
      if (fs.existsSync(candidate)) {
        return true;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  return false;
}

export function runAnalysis(input: AnalysisContextInput): RunAnalysisResult {
  const context = createAnalysisContext(input);
  const { baseDir, options } = context;

  const packageJsonPath = findNearestPackageJson(baseDir);
  const searchDirs = new Set<string>([baseDir]);
  if (packageJsonPath) {
    searchDirs.add(path.dirname(packageJsonPath));
  }

  const hasNodeModules = hasNodeModulesDirectory(searchDirs);
  const resolveExternalTypes =
    options.resolveExternalTypes !== undefined ? options.resolveExternalTypes : hasNodeModules;

  // Filter benign TS5053 (allowJs with isolatedDeclarations/declaration)
  const diagnostics = ts.getPreEmitDiagnostics(context.program).filter((d) => {
    if (d.code === 5053) return false;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    return !/allowJs/i.test(msg);
  });

  const spec = buildOpenPkgSpec(context, resolveExternalTypes);

  return {
    spec,
    metadata: {
      baseDir,
      configPath: context.configPath,
      packageJsonPath,
      hasNodeModules,
      resolveExternalTypes,
    },
    diagnostics,
  };
}
