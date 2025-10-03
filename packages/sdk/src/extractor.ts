import { runAnalysis } from './analysis/run-analysis';
import type { OpenPkgOptions } from './options';
import type { OpenPkgSpec } from './types/openpkg';

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
