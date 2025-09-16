import * as fs from 'node:fs';
import * as path from 'node:path';
import type { z } from 'zod';
import { createAnalysisContext } from './analysis/context';
import { buildOpenPkgSpec } from './analysis/spec-builder';
import type { OpenPkgOptions } from './options';
import type { openPkgSchema } from './types/openpkg';

export async function extractPackageSpec(
  entryFile: string,
  packageDir?: string,
  content?: string,
  options?: OpenPkgOptions,
): Promise<z.infer<typeof openPkgSchema>> {
  const context = createAnalysisContext({
    entryFile,
    packageDir,
    content,
    options,
  });

  const { baseDir, options: normalizedOptions } = context;

  const nodeModulesPath = path.join(baseDir, 'node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesPath);

  const resolveExternalTypes =
    normalizedOptions.resolveExternalTypes !== undefined
      ? normalizedOptions.resolveExternalTypes
      : hasNodeModules;

  if (hasNodeModules && resolveExternalTypes) {
    console.log('node_modules detected, resolving external types');
  }

  return buildOpenPkgSpec(context, resolveExternalTypes);
}
