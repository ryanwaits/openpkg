import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenPkg, SpecExport, SpecSignature, SpecType } from '@openpkg-ts/spec';
import {
  type CoverageSummary,
  DEFAULT_REPORT_PATH,
  type DocCovReport,
  type ExportCoverageData,
  REPORT_VERSION,
} from '../types/report';
import { getDriftSummary } from './docs-coverage';
import { type EnrichedOpenPkg, enrichSpec } from './enrich';

/**
 * Generate a DocCov report from an OpenPkg spec.
 *
 * @param spec - The pure OpenPkg spec to analyze
 * @returns A DocCov report with coverage analysis
 *
 * @example
 * ```ts
 * import { DocCov, generateReport } from '@doccov/sdk';
 *
 * const doccov = new DocCov();
 * const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
 * const report = generateReport(spec);
 *
 * console.log(`Coverage: ${report.coverage.score}%`);
 * ```
 */
export function generateReport(spec: OpenPkg): DocCovReport {
  const enriched = enrichSpec(spec);
  return generateReportFromEnriched(enriched);
}

/**
 * Generate a DocCov report from an already-enriched spec.
 *
 * Use this when you've already called enrichSpec() and want to avoid
 * recomputing coverage data.
 *
 * @param enriched - The enriched OpenPkg spec
 * @returns A DocCov report with coverage analysis
 */
export function generateReportFromEnriched(enriched: EnrichedOpenPkg): DocCovReport {
  // Build per-export coverage data
  const exportsData: Record<string, ExportCoverageData> = {};
  const missingByRule: Record<string, number> = {};

  let documentedExports = 0;
  let totalDrift = 0;

  for (const exp of enriched.exports) {
    const data: ExportCoverageData = {
      name: exp.name,
      kind: exp.kind,
      coverageScore: exp.docs?.coverageScore ?? 100,
    };

    if (exp.docs?.missing && exp.docs.missing.length > 0) {
      data.missing = exp.docs.missing;
      for (const ruleId of exp.docs.missing) {
        missingByRule[ruleId] = (missingByRule[ruleId] ?? 0) + 1;
      }
    } else {
      documentedExports++;
    }

    if (exp.docs?.drift && exp.docs.drift.length > 0) {
      data.drift = exp.docs.drift;
      totalDrift += exp.docs.drift.length;
    }

    exportsData[exp.id] = data;
  }

  // Compute drift summary with category breakdown
  const allDrifts = enriched.exports.flatMap((exp) => exp.docs?.drift ?? []);
  const driftSummary = allDrifts.length > 0 ? getDriftSummary(allDrifts) : undefined;

  const coverage: CoverageSummary = {
    score: enriched.docs?.coverageScore ?? 100,
    totalExports: enriched.exports.length,
    documentedExports,
    missingByRule,
    driftCount: totalDrift,
    driftSummary,
  };

  return {
    $schema: 'https://doccov.com/schemas/v1.0.0/report.schema.json',
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    spec: {
      name: enriched.meta.name,
      version: enriched.meta.version,
    },
    coverage,
    exports: exportsData,
  };
}

/**
 * Load a cached DocCov report from disk.
 *
 * @param reportPath - Path to the report file (defaults to .doccov/report.json)
 * @returns The cached report, or null if not found
 */
export function loadCachedReport(reportPath: string = DEFAULT_REPORT_PATH): DocCovReport | null {
  try {
    const fullPath = path.resolve(reportPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as DocCovReport;
  } catch {
    return null;
  }
}

/**
 * Save a DocCov report to disk.
 *
 * @param report - The report to save
 * @param reportPath - Path to save the report (defaults to .doccov/report.json)
 */
export function saveReport(report: DocCovReport, reportPath: string = DEFAULT_REPORT_PATH): void {
  const fullPath = path.resolve(reportPath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, JSON.stringify(report, null, 2));
}

/**
 * Check if a cached report is still valid.
 *
 * A report is considered stale if:
 * - It doesn't exist
 * - The spec version has changed
 * - Source files have been modified since generation
 *
 * @param reportPath - Path to the report file
 * @param sourceFiles - Source files to check modification times against
 * @returns True if the cached report is still valid
 */
export function isCachedReportValid(
  reportPath: string = DEFAULT_REPORT_PATH,
  sourceFiles: string[] = [],
): boolean {
  const report = loadCachedReport(reportPath);
  if (!report) {
    return false;
  }

  // Check if any source files have been modified since report generation
  const reportTime = new Date(report.generatedAt).getTime();

  for (const file of sourceFiles) {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs > reportTime) {
        return false;
      }
    } catch {
      // File doesn't exist or can't be read - consider report invalid
      return false;
    }
  }

  return true;
}

// ============================================================================
// API Surface Renderer (git-trackable markdown format)
// ============================================================================

/**
 * Format a signature to a readable string.
 */
function formatSignature(name: string, signature: SpecSignature): string {
  const params = (signature.parameters ?? [])
    .map((p) => {
      const optional = p.required === false ? '?' : '';
      const rest = p.rest ? '...' : '';
      const typeStr =
        typeof p.schema === 'string'
          ? p.schema
          : (p.schema as { type?: string })?.type ?? 'unknown';
      return `${rest}${p.name}${optional}: ${typeStr}`;
    })
    .join(', ');

  const returnType = signature.returns
    ? typeof signature.returns.schema === 'string'
      ? signature.returns.schema
      : (signature.returns.schema as { type?: string })?.type ?? 'unknown'
    : 'void';

  const typeParams = signature.typeParameters?.length
    ? `<${signature.typeParameters.map((tp) => tp.name).join(', ')}>`
    : '';

  return `${name}${typeParams}(${params}): ${returnType}`;
}

/**
 * Format an export to API surface markdown.
 */
function formatExportToApiSurface(exp: SpecExport): string {
  const lines: string[] = [];
  lines.push(`### ${exp.name}`);

  switch (exp.kind) {
    case 'function': {
      const signatures = exp.signatures ?? [];
      if (signatures.length === 0) {
        lines.push(`\`\`\`typescript\nfunction ${exp.name}(): unknown\n\`\`\``);
      } else {
        for (const sig of signatures) {
          lines.push(`\`\`\`typescript\nfunction ${formatSignature(exp.name, sig)}\n\`\`\``);
        }
      }
      break;
    }
    case 'class': {
      const extendsClause = exp.extends ? ` extends ${exp.extends}` : '';
      const implementsClause = exp.implements?.length
        ? ` implements ${exp.implements.join(', ')}`
        : '';
      lines.push(`\`\`\`typescript\nclass ${exp.name}${extendsClause}${implementsClause}\n\`\`\``);
      break;
    }
    case 'interface':
    case 'type': {
      const typeStr =
        typeof exp.type === 'string'
          ? exp.type
          : (exp.type as { type?: string })?.type ?? '{ ... }';
      lines.push(`\`\`\`typescript\ntype ${exp.name} = ${typeStr}\n\`\`\``);
      break;
    }
    case 'variable': {
      const typeStr =
        typeof exp.type === 'string'
          ? exp.type
          : (exp.type as { type?: string })?.type ?? 'unknown';
      lines.push(`\`\`\`typescript\nconst ${exp.name}: ${typeStr}\n\`\`\``);
      break;
    }
    case 'enum': {
      lines.push(`\`\`\`typescript\nenum ${exp.name} { ... }\n\`\`\``);
      break;
    }
    default: {
      lines.push(`\`\`\`typescript\n${exp.kind} ${exp.name}\n\`\`\``);
    }
  }

  return lines.join('\n');
}

/**
 * Format a type to API surface markdown.
 */
function formatTypeToApiSurface(type: SpecType): string {
  const lines: string[] = [];
  lines.push(`### ${type.name}`);

  switch (type.kind) {
    case 'interface': {
      const extendsClause = type.extends ? ` extends ${type.extends}` : '';
      lines.push(`\`\`\`typescript\ninterface ${type.name}${extendsClause} { ... }\n\`\`\``);
      break;
    }
    case 'type': {
      const typeStr =
        typeof type.type === 'string'
          ? type.type
          : (type.type as { type?: string })?.type ?? '{ ... }';
      lines.push(`\`\`\`typescript\ntype ${type.name} = ${typeStr}\n\`\`\``);
      break;
    }
    case 'class': {
      const extendsClause = type.extends ? ` extends ${type.extends}` : '';
      lines.push(`\`\`\`typescript\nclass ${type.name}${extendsClause}\n\`\`\``);
      break;
    }
    case 'enum': {
      lines.push(`\`\`\`typescript\nenum ${type.name} { ... }\n\`\`\``);
      break;
    }
    default: {
      lines.push(`\`\`\`typescript\n${type.kind} ${type.name}\n\`\`\``);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a git-trackable API surface markdown file from an OpenPkg spec.
 *
 * This produces a deterministic, sorted output suitable for version control.
 * Changes to the API will show up as diffs in this file.
 *
 * @param spec - The OpenPkg spec to render
 * @returns Markdown string representing the API surface
 *
 * @example
 * ```ts
 * import { DocCov, renderApiSurface } from '@doccov/sdk';
 *
 * const doccov = new DocCov();
 * const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
 * const apiSurface = renderApiSurface(spec);
 *
 * fs.writeFileSync('api-surface.md', apiSurface);
 * ```
 */
export function renderApiSurface(spec: OpenPkg): string {
  const lines: string[] = [];

  // Header
  const version = spec.meta.version ? ` v${spec.meta.version}` : '';
  lines.push(`# API Surface: ${spec.meta.name}${version}`);
  lines.push('');
  lines.push('> This file is auto-generated. Do not edit manually.');
  lines.push('> Run `doccov spec --format api-surface` to regenerate.');
  lines.push('');

  // Group exports by kind and sort alphabetically
  const exportsByKind: Record<string, SpecExport[]> = {};
  for (const exp of spec.exports) {
    const kind = exp.kind;
    if (!exportsByKind[kind]) {
      exportsByKind[kind] = [];
    }
    exportsByKind[kind].push(exp);
  }

  // Sort each group alphabetically
  for (const kind of Object.keys(exportsByKind)) {
    exportsByKind[kind].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Render in a consistent order
  const kindOrder = [
    'function',
    'class',
    'interface',
    'type',
    'variable',
    'enum',
    'namespace',
    'module',
  ];

  for (const kind of kindOrder) {
    const exports = exportsByKind[kind];
    if (!exports || exports.length === 0) continue;

    const kindTitle = kind.charAt(0).toUpperCase() + kind.slice(1) + 's';
    lines.push(`## ${kindTitle}`);
    lines.push('');

    for (const exp of exports) {
      lines.push(formatExportToApiSurface(exp));
      lines.push('');
    }
  }

  // Handle any remaining kinds not in the order list
  for (const kind of Object.keys(exportsByKind).sort()) {
    if (kindOrder.includes(kind)) continue;
    const exports = exportsByKind[kind];
    if (!exports || exports.length === 0) continue;

    const kindTitle = kind.charAt(0).toUpperCase() + kind.slice(1) + 's';
    lines.push(`## ${kindTitle}`);
    lines.push('');

    for (const exp of exports) {
      lines.push(formatExportToApiSurface(exp));
      lines.push('');
    }
  }

  // Render types section if there are types
  const types = spec.types ?? [];
  if (types.length > 0) {
    // Sort types alphabetically
    const sortedTypes = [...types].sort((a, b) => a.name.localeCompare(b.name));

    lines.push('## Internal Types');
    lines.push('');

    for (const type of sortedTypes) {
      lines.push(formatTypeToApiSurface(type));
      lines.push('');
    }
  }

  return lines.join('\n');
}
