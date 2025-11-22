import { runAnalysis } from './analysis/run-analysis';
import type { OpenPkgSpec } from './analysis/spec-types';
import type { OpenPkgOptions } from './options';

export async function extractPackageSpec(
  entryFile: string,
  packageDir?: string,
  content?: string,
  options?: OpenPkgOptions,
): Promise<OpenPkgSpec> {
  const result = runAnalysis({
    entryFile,
    packageDir,
    content,
    options,
  });

  return result.spec;
}
