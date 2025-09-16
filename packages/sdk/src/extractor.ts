import type { z } from 'zod';
import { runAnalysis } from './analysis/run-analysis';
import type { OpenPkgOptions } from './options';
import type { openPkgSchema } from './types/openpkg';

export async function extractPackageSpec(
  entryFile: string,
  packageDir?: string,
  content?: string,
  options?: OpenPkgOptions,
): Promise<z.infer<typeof openPkgSchema>> {
  const result = runAnalysis({
    entryFile,
    packageDir,
    content,
    options,
  });

  return result.spec;
}
