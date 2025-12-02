/**
 * Build script and exotic project detection.
 */

import type { FileSystem, BuildInfo } from './types';
import { readPackageJson } from './utils';

/**
 * Detect build configuration and exotic project indicators.
 *
 * @param fs - FileSystem implementation
 * @param packagePath - Path to package directory (default: ".")
 * @returns Build info including scripts and exotic indicators
 */
export async function detectBuildInfo(fs: FileSystem, packagePath = '.'): Promise<BuildInfo> {
  const pkgJson = await readPackageJson(fs, packagePath);
  const scripts = pkgJson?.scripts ?? {};
  const scriptNames = Object.keys(scripts);

  // Find build-related scripts
  const buildScripts = scriptNames.filter(
    (name) =>
      name === 'build' ||
      name === 'compile' ||
      name === 'tsc' ||
      name.startsWith('build:') ||
      name.startsWith('compile:'),
  );

  // Check for TypeScript
  const tsconfigPath = packagePath === '.' ? 'tsconfig.json' : `${packagePath}/tsconfig.json`;
  const hasTsConfig = await fs.exists(tsconfigPath);
  const hasTsDep =
    pkgJson?.devDependencies?.typescript !== undefined ||
    pkgJson?.dependencies?.typescript !== undefined;
  const hasTypeScript = hasTsConfig || hasTsDep;

  // Detect exotic indicators
  const wasm = await detectWasmProject(fs, packagePath, scripts);
  const napi = detectNapiProject(pkgJson);

  return {
    scripts: buildScripts,
    hasBuildScript: buildScripts.length > 0,
    hasTypeScript,
    exoticIndicators: { wasm, napi },
  };
}

/**
 * Detect if this is a WASM project (Rust/wasm-pack).
 */
async function detectWasmProject(
  fs: FileSystem,
  packagePath: string,
  scripts: Record<string, string>,
): Promise<boolean> {
  // Check for Cargo.toml in package directory
  const pkgCargoPath = packagePath === '.' ? 'Cargo.toml' : `${packagePath}/Cargo.toml`;
  if (await fs.exists(pkgCargoPath)) return true;

  // Check for Cargo.toml at repo root (common for WASM packages)
  if (packagePath !== '.' && (await fs.exists('Cargo.toml'))) return true;

  // Check for wasm-pack in scripts
  const allScripts = Object.values(scripts).join(' ');
  return allScripts.includes('wasm-pack') || allScripts.includes('wasm');
}

/**
 * Detect if this is a napi-rs native addon project.
 */
function detectNapiProject(
  pkgJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null,
): boolean {
  if (!pkgJson) return false;

  const deps = {
    ...(pkgJson.dependencies ?? {}),
    ...(pkgJson.devDependencies ?? {}),
  };

  return Object.keys(deps).some((dep) => dep.includes('napi'));
}

/**
 * Get the primary build script name to run.
 * Prefers 'build' over 'compile' over 'tsc'.
 */
export function getPrimaryBuildScript(buildInfo: BuildInfo): string | null {
  if (buildInfo.scripts.includes('build')) return 'build';
  if (buildInfo.scripts.includes('compile')) return 'compile';
  if (buildInfo.scripts.includes('tsc')) return 'tsc';
  return buildInfo.scripts[0] ?? null;
}
