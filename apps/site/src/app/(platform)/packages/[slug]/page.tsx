'use client';

import { Breadcrumb } from '@doccov/ui/breadcrumb';
import { Button } from '@doccov/ui/button';
import { FileChangeList, FileChangeRow } from '@doccov/ui/file-change-row';
import { FileChip } from '@doccov/ui/file-chip';
import { SegmentedTabs, type TabCell } from '@doccov/ui/tabs';
import { Clock, ExternalLink, FileText, GitBranch } from 'lucide-react';
import { use, useState } from 'react';

// Example code snippets for different files
const codeExamples: Record<string, { documented: string; undocumented: string }> = {
  'index.ts': {
    documented: `/**
 * Creates a new OpenAPI schema from Zod types
 * @param schema - The Zod schema to convert
 * @returns OpenAPI schema object
 */
// !diff +
export function createSchema<T extends z.ZodType>(schema: T) {
  return zodToOpenAPI(schema);
}`,
    undocumented: `// Missing JSDoc documentation
// !diff -
export function createSchema<T extends z.ZodType>(schema: T) {
  return zodToOpenAPI(schema);
}`,
  },
  'response.ts': {
    documented: ``,
    undocumented: `// !diff -
export interface ResponseSchema {
  status: number;
  data: unknown;
}

// !diff -
export function createResponse(status: number, data: unknown) {
  return { status, data };
}`,
  },
  'helpers.ts': {
    documented: ``,
    undocumented: `// !diff -
export function normalizeString(str: string) {
  return str.trim().toLowerCase();
}

// !diff -
export function parseJSON<T>(json: string): T {
  return JSON.parse(json);
}`,
  },
  'base.ts': {
    documented: `/**
 * Base schema type for all OpenAPI definitions
 * @template T - The underlying data type
 */
// !diff +
export type BaseSchema<T> = {
  type: string;
  description?: string;
  example?: T;
};`,
    undocumented: ``,
  },
  'request.ts': {
    documented: `/**
 * Request body schema for API endpoints
 * @template T - The request payload type
 */
// !diff +
export interface RequestSchema<T> {
  body: T;
  headers?: Record<string, string>;
}

/**
 * Creates a typed request schema
 * @param bodySchema - Zod schema for request body
 */
// !diff +
export function createRequestSchema<T>(bodySchema: z.ZodType<T>) {
  return z.object({ body: bodySchema });
}`,
    undocumented: ``,
  },
  'transform.ts': {
    documented: `/**
 * Transforms Zod schema to OpenAPI format
 * @param schema - The Zod schema to transform
 * @returns OpenAPI-compatible schema object
 */
// !diff +
export function transformToOpenAPI(schema: z.ZodType) {
  return zodToJsonSchema(schema);
}

/**
 * Merges multiple schemas into a single definition
 * @param schemas - Array of schemas to merge
 */
// !diff +
export function mergeSchemas(...schemas: z.ZodType[]) {
  return z.union(schemas as [z.ZodType, z.ZodType]);
}`,
    undocumented: ``,
  },
  'analyze.ts': {
    documented: `/**
 * Analyzes documentation coverage for a package
 * @param entryPoint - Path to package entry
 * @returns Coverage report with metrics
 */
// !diff +
export async function analyzePackage(entryPoint: string) {
  const exports = await extractExports(entryPoint);
  return computeCoverage(exports);
}`,
    undocumented: ``,
  },
  'json.ts': {
    documented: `/**
 * JSON reporter for coverage output
 * @param report - Coverage report data
 * @returns Formatted JSON string
 */
// !diff +
export function formatAsJSON(report: CoverageReport) {
  return JSON.stringify(report, null, 2);
}`,
    undocumented: ``,
  },
  'init.ts': {
    documented: ``,
    undocumented: `// !diff -
export async function initConfig(cwd: string) {
  const configPath = path.join(cwd, 'doccov.config.ts');
  await writeFile(configPath, defaultConfig);
}`,
  },
  'config.ts': {
    documented: ``,
    undocumented: `// !diff -
export function loadConfig(path: string) {
  return require(path);
}`,
  },
  'render.ts': {
    documented: `/**
 * Renders footnote content to HTML
 * @param content - Markdown content with footnotes
 */
// !diff +
export function renderFootnotes(content: string) {
  return parseAndRender(content);
}`,
    undocumented: ``,
  },
  'footnote.ts': {
    documented: ``,
    undocumented: `// !diff -
export class Footnote {
  constructor(public id: string, public content: string) {}

// !diff -
  render() {
    return \`<sup>\${this.id}</sup>\`;
  }
}`,
  },
  'parser.ts': {
    documented: ``,
    undocumented: `// !diff -
export function parseFootnotes(text: string) {
  const regex = /\\[\\^(\\d+)\\]/g;
  return text.match(regex) || [];
}`,
  },
};

// Mock data
const mockPackageData: Record<
  string,
  {
    name: string;
    description: string;
    coverage: number;
    documented: number;
    total: number;
    lastRun: string;
    repoUrl: string;
    branch: string;
    exports: {
      documented: { path: string; filename: string; count: number }[];
      undocumented: { path: string; filename: string; count: number }[];
    };
  }
> = {
  'zod-openapi': {
    name: 'zod-openapi',
    description: 'Generate OpenAPI documentation from Zod schemas',
    coverage: 78,
    documented: 156,
    total: 200,
    lastRun: '2 hours ago',
    repoUrl: 'https://github.com/samchungy/zod-openapi',
    branch: 'main',
    exports: {
      documented: [
        { path: 'src/', filename: 'index.ts', count: 45 },
        { path: 'src/schemas/', filename: 'base.ts', count: 32 },
        { path: 'src/schemas/', filename: 'request.ts', count: 28 },
        { path: 'src/utils/', filename: 'transform.ts', count: 51 },
      ],
      undocumented: [
        { path: 'src/schemas/', filename: 'response.ts', count: 12 },
        { path: 'src/utils/', filename: 'helpers.ts', count: 8 },
        { path: 'src/types/', filename: 'index.ts', count: 24 },
      ],
    },
  },
  'doccov-cli': {
    name: '@doccov/cli',
    description: 'CLI tool for documentation coverage analysis',
    coverage: 92,
    documented: 46,
    total: 50,
    lastRun: '30 minutes ago',
    repoUrl: 'https://github.com/doccov/cli',
    branch: 'main',
    exports: {
      documented: [
        { path: 'src/', filename: 'index.ts', count: 12 },
        { path: 'src/commands/', filename: 'analyze.ts', count: 18 },
        { path: 'src/reporters/', filename: 'json.ts', count: 16 },
      ],
      undocumented: [
        { path: 'src/commands/', filename: 'init.ts', count: 2 },
        { path: 'src/utils/', filename: 'config.ts', count: 2 },
      ],
    },
  },
  footnote: {
    name: 'footnote',
    description: 'A minimal footnote library',
    coverage: 45,
    documented: 9,
    total: 20,
    lastRun: '1 day ago',
    repoUrl: 'https://github.com/example/footnote',
    branch: 'main',
    exports: {
      documented: [
        { path: 'src/', filename: 'index.ts', count: 5 },
        { path: 'src/', filename: 'render.ts', count: 4 },
      ],
      undocumented: [
        { path: 'src/', filename: 'footnote.ts', count: 6 },
        { path: 'src/utils/', filename: 'parser.ts', count: 5 },
      ],
    },
  },
};

function getCodeblock(filename: string, type: 'documented' | 'undocumented') {
  const example = codeExamples[filename];
  const code = example?.[type];
  if (!code) return undefined;
  return { value: code, lang: 'typescript', meta: '' };
}

export default function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const pkg = mockPackageData[slug];
  const [activeTab, setActiveTab] = useState('overview');

  if (!pkg) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <FileText className="size-12 text-muted-foreground/30 mb-4" strokeWidth={1} />
        <h2 className="text-xl font-semibold mb-2">Package not found</h2>
        <p className="text-muted-foreground">
          The package &quot;{slug}&quot; doesn&apos;t exist or you don&apos;t have access.
        </p>
      </div>
    );
  }

  const tabs: TabCell[] = [
    { id: 'overview', type: 'text', label: 'Overview' },
    { id: 'documented', type: 'count', label: 'Documented', count: pkg.documented },
    { id: 'undocumented', type: 'count', label: 'Undocumented', count: pkg.total - pkg.documented },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Breadcrumb
          items={[
            { id: 'packages', label: 'Packages', hasDropdown: true },
            { id: slug, label: pkg.name, hasDropdown: false },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ExternalLink className="size-4" />}
          onClick={() => window.open(pkg.repoUrl, '_blank')}
        >
          View repo
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <SegmentedTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="text-sm text-foreground">
            <p className="mb-2">{pkg.description}</p>
            <p>
              <span className="font-medium tabular-nums">{pkg.coverage}%</span> coverage —{' '}
              <span className="font-medium tabular-nums">{pkg.documented}</span> of{' '}
              <span className="font-medium tabular-nums">{pkg.total}</span> exports documented.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <GitBranch className="size-3.5" />
                {pkg.branch}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Last run {pkg.lastRun}
              </span>
            </div>
          </div>

          {/* Quick file refs */}
          <div className="text-sm text-foreground">
            <p className="text-muted-foreground mb-2">Files missing documentation:</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {pkg.exports.undocumented.map((file) => (
                <FileChip key={file.filename} filename={file.filename} />
              ))}
            </div>
          </div>

          {/* Summary list */}
          <FileChangeList
            title="All files"
            count={pkg.exports.documented.length + pkg.exports.undocumented.length}
            defaultOpen
          >
            {pkg.exports.documented.map((file) => (
              <FileChangeRow
                key={file.path + file.filename}
                path={file.path}
                filename={file.filename}
                additions={file.count}
                codeblock={getCodeblock(file.filename, 'documented')}
              />
            ))}
            {pkg.exports.undocumented.map((file) => (
              <FileChangeRow
                key={file.path + file.filename}
                path={file.path}
                filename={file.filename}
                deletions={file.count}
                codeblock={getCodeblock(file.filename, 'undocumented')}
              />
            ))}
          </FileChangeList>
        </div>
      )}

      {activeTab === 'documented' && (
        <div className="space-y-6">
          <div className="text-sm text-foreground">
            <p>
              <span className="font-medium tabular-nums">{pkg.documented}</span> exports with
              documentation across{' '}
              <span className="font-medium">{pkg.exports.documented.length}</span> files.
            </p>
          </div>

          <FileChangeList
            title="Documented files"
            count={pkg.exports.documented.length}
            defaultOpen
          >
            {pkg.exports.documented.map((file) => (
              <FileChangeRow
                key={file.path + file.filename}
                path={file.path}
                filename={file.filename}
                additions={file.count}
                codeblock={getCodeblock(file.filename, 'documented')}
              />
            ))}
          </FileChangeList>
        </div>
      )}

      {activeTab === 'undocumented' && (
        <div className="space-y-6">
          <div className="text-sm text-foreground">
            <p>
              <span className="font-medium tabular-nums">{pkg.total - pkg.documented}</span> exports
              missing documentation in{' '}
              <span className="font-medium">{pkg.exports.undocumented.length}</span> files:
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {pkg.exports.undocumented.map((file) => (
                <FileChip key={file.filename} filename={file.filename} />
              ))}
            </div>
          </div>

          <FileChangeList
            title="Files with missing docs"
            count={pkg.exports.undocumented.length}
            defaultOpen
          >
            {pkg.exports.undocumented.map((file) => (
              <FileChangeRow
                key={file.path + file.filename}
                path={file.path}
                filename={file.filename}
                deletions={file.count}
                codeblock={getCodeblock(file.filename, 'undocumented')}
              />
            ))}
          </FileChangeList>
        </div>
      )}
    </div>
  );
}
