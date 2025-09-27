import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type NormalizedOpenPkgConfig, normalizeConfig, openPkgConfigSchema } from './schema';

export const OPENPKG_CONFIG_FILENAMES = [
  'openpkg.config.ts',
  'openpkg.config.mts',
  'openpkg.config.cts',
  'openpkg.config.js',
  'openpkg.config.mjs',
  'openpkg.config.cjs',
] as const;

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const findConfigFile = async (cwd: string): Promise<string | null> => {
  let current = path.resolve(cwd);
  const { root } = path.parse(current);

  while (true) {
    for (const candidate of OPENPKG_CONFIG_FILENAMES) {
      const candidatePath = path.join(current, candidate);
      if (await fileExists(candidatePath)) {
        return candidatePath;
      }
    }

    if (current === root) {
      return null;
    }

    current = path.dirname(current);
  }
};

export interface LoadedOpenPkgConfig extends NormalizedOpenPkgConfig {
  filePath: string;
}

const importConfigModule = async (absolutePath: string): Promise<unknown> => {
  const fileUrl = pathToFileURL(absolutePath);
  // Bust the import cache so edits are picked up between runs.
  fileUrl.searchParams.set('t', Date.now().toString());
  const module = await import(fileUrl.href);
  return module?.default ?? module?.config ?? module;
};

const formatIssues = (issues: string[]): string => issues.map((issue) => `- ${issue}`).join('\n');

export const loadOpenPkgConfigInternal = async (
  cwd: string,
): Promise<LoadedOpenPkgConfig | null> => {
  const configPath = await findConfigFile(cwd);
  if (!configPath) {
    return null;
  }

  let rawConfig: unknown;
  try {
    rawConfig = await importConfigModule(configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load OpenPkg config at ${configPath}: ${message}`);
  }

  const parsed = openPkgConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${pathLabel}: ${issue.message}`;
    });

    throw new Error(`Invalid OpenPkg configuration at ${configPath}.\n${formatIssues(issues)}`);
  }

  const normalized = normalizeConfig(parsed.data);

  return {
    filePath: configPath,
    ...normalized,
  };
};

export { loadOpenPkgConfigInternal as loadOpenPkgConfig };

export type { NormalizedOpenPkgConfig };
