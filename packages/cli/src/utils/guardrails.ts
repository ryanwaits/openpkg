import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AnalysisResult, Diagnostic } from 'openpkg-sdk';

type Severity = 'info' | 'warning' | 'error';

export interface GuardrailMessage {
  severity: Severity;
  message: string;
  suggestion?: string;
}

export interface GuardrailSummary {
  messages: GuardrailMessage[];
}

export interface GuardrailInput {
  cwd: string;
  entryPath: string;
  analysis: AnalysisResult;
}

interface PackageJsonLike {
  name?: string;
  workspaces?: unknown;
  scripts?: Record<string, string>;
  packageManager?: string;
}

interface PackageManagerInfo {
  name: string;
  installCommand: string;
  runScript: (script: string) => string;
}

const BUILD_OUTPUT_CANDIDATES = ['dist', 'lib', 'build', 'out', 'types'];

const TEST_GLOBALS = new Set([
  'describe',
  'it',
  'expect',
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
  'test',
]);

export function collectGuardrailInsights(input: GuardrailInput): GuardrailSummary {
  const { cwd, entryPath, analysis } = input;
  const { metadata, diagnostics } = analysis;

  const messages: GuardrailMessage[] = [];

  const packageJsonPath = metadata.packageJsonPath;
  const packageRoot = packageJsonPath ? path.dirname(packageJsonPath) : undefined;

  const packageJson = packageJsonPath ? readPackageJson(packageJsonPath) : undefined;
  const pmInfo = detectPackageManager(packageRoot, packageJson);

  if (packageRoot) {
    if (!metadata.hasNodeModules) {
      messages.push({
        severity: 'warning',
        message: 'Dependencies were not detected for this package.',
        suggestion: `Run ${formatCommand(pmInfo.installCommand)} in ${formatRelative(cwd, packageRoot)} and rerun the analysis.`,
      });
    }

    const buildScript = packageJson?.scripts?.build;
    if (buildScript) {
      const hasArtifacts = BUILD_OUTPUT_CANDIDATES.some((candidate) =>
        fs.existsSync(path.join(packageRoot, candidate)),
      );

      if (!hasArtifacts) {
        messages.push({
          severity: 'warning',
          message: 'Build artifacts were not found; generated types may be incomplete.',
          suggestion: `Run ${formatCommand(pmInfo.runScript('build'))} before analyzing to include generated declarations.`,
        });
      }
    }

    if (isWorkspacePackage(packageJson)) {
      messages.push({
        severity: 'info',
        message: 'Workspace project detected.',
        suggestion:
          'Run installs and builds from the repository root so internal packages stay in sync.',
      });
    }
  }

  if (!metadata.configPath) {
    messages.push({
      severity: 'info',
      message: 'No tsconfig detected for this entry; fallback compiler defaults were used.',
      suggestion:
        'Add a tsconfig.json or pass `--project` to point OpenPkg at the correct compiler configuration.',
    });
  }

  messages.push(...mapDiagnosticsToMessages(diagnostics, cwd, entryPath));

  return { messages };
}

function readPackageJson(packageJsonPath: string): PackageJsonLike | undefined {
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(raw) as PackageJsonLike;
  } catch (_error) {
    return undefined;
  }
}

function detectPackageManager(
  packageRoot: string | undefined,
  packageJson: PackageJsonLike | undefined,
): PackageManagerInfo {
  const pmFromField = packageJson?.packageManager?.split('@')[0];
  const candidate = pmFromField ?? detectByLockfile(packageRoot);

  switch (candidate) {
    case 'pnpm':
      return {
        name: 'pnpm',
        installCommand: 'pnpm install',
        runScript: (script) => `pnpm run ${script}`,
      };
    case 'yarn':
      return {
        name: 'yarn',
        installCommand: 'yarn install',
        runScript: (script) => `yarn ${script}`,
      };
    case 'bun':
      return {
        name: 'bun',
        installCommand: 'bun install',
        runScript: (script) => `bun run ${script}`,
      };
    default:
      return {
        name: 'npm',
        installCommand: 'npm install',
        runScript: (script) => `npm run ${script}`,
      };
  }
}

function detectByLockfile(packageRoot: string | undefined): string | undefined {
  if (!packageRoot) {
    return undefined;
  }

  const lookup: Array<[string, string]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ];

  for (const [filename, tool] of lookup) {
    if (fs.existsSync(path.join(packageRoot, filename))) {
      return tool;
    }
  }

  return undefined;
}

function isWorkspacePackage(packageJson: PackageJsonLike | undefined): boolean {
  if (!packageJson) {
    return false;
  }

  const { workspaces } = packageJson;
  if (workspaces == null) {
    return false;
  }

  if (Array.isArray(workspaces)) {
    return workspaces.length > 0;
  }

  if (typeof workspaces === 'object') {
    const maybePackages = (workspaces as { packages?: unknown }).packages;
    return Array.isArray(maybePackages) && maybePackages.length > 0;
  }

  return false;
}

function mapDiagnosticsToMessages(
  diagnostics: Diagnostic[],
  cwd: string,
  entryPath: string,
): GuardrailMessage[] {
  const sorted = [...diagnostics].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
  const used = new Set<string>();
  const messages: GuardrailMessage[] = [];

  for (const diagnostic of sorted) {
    const key = `${diagnostic.message}|${diagnostic.location?.file ?? ''}|${diagnostic.location?.line ?? 0}`;
    if (used.has(key)) {
      continue;
    }
    used.add(key);

    const severity: Severity =
      diagnostic.severity === 'error'
        ? 'error'
        : diagnostic.severity === 'warning'
          ? 'warning'
          : 'info';
    if (severity === 'info') {
      continue;
    }

    const location = formatLocation(diagnostic.location, cwd, entryPath);
    const suggestion = inferDiagnosticSuggestion(diagnostic);

    messages.push({
      severity,
      message: `${capitalize(severity)}: ${diagnostic.message}${location ? ` (${location})` : ''}`,
      suggestion,
    });

    if (messages.length >= 5) {
      break;
    }
  }

  return messages;
}

function inferDiagnosticSuggestion(diagnostic: Diagnostic): string | undefined {
  const message = diagnostic.message;

  const missingModule = /Cannot find module '([^']+)'/i.exec(message);
  if (missingModule) {
    return `Install or build the module ${formatCommand(missingModule[1])} so TypeScript can resolve it.`;
  }

  const missingName = /Cannot find name '([^']+)'/i.exec(message);
  if (missingName) {
    const name = missingName[1];
    if (TEST_GLOBALS.has(name)) {
      return 'Add the relevant test type definitions (e.g. install `@types/jest` or configure the `types` array in tsconfig).';
    }
    return `Declare ${formatCommand(name)} or ensure its type definitions are available.`;
  }

  return undefined;
}

function severityRank(severity: Severity): number {
  switch (severity) {
    case 'error':
      return 3;
    case 'warning':
      return 2;
    default:
      return 1;
  }
}

function formatLocation(
  location: Diagnostic['location'],
  cwd: string,
  entryPath: string,
): string | undefined {
  if (!location) {
    return undefined;
  }

  const relativeFile = formatRelative(cwd, location.file ?? entryPath);
  const linePart = location.line
    ? `:${location.line}${location.column ? `:${location.column}` : ''}`
    : '';
  return `${relativeFile}${linePart}`;
}

function formatRelative(from: string, to: string): string {
  const relative = path.relative(from, to);
  if (!relative || relative === '') {
    return '.';
  }
  return relative;
}

function formatCommand(value: string): string {
  return `\`${value}\``;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
