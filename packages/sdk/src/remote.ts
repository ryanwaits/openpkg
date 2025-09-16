import { OpenPkg } from './openpkg';
import type { OpenPkgSpec } from './types/openpkg';
import type { OpenPkgOptions } from './options';
import { GitHubFetcher, GitHubFetchError } from './remote/fetcher/github-fetcher';
import { ImportParser, type ImportInfo, type ParseResult } from './remote/parser/import-parser';
import { ImportResolver, type ImportResolverOptions } from './remote/resolver/import-resolver';
import { TypeMerger } from './remote/merger/type-merger';
import { ExportMerger } from './remote/merger/export-merger';
import type { RemoteCache } from './remote/cache/cache';
import { InMemoryRemoteCache } from './remote/cache/cache';

export type RemoteAnalysisImport = ImportInfo;

export interface RemoteAnalysisMetadata {
  filesAnalyzed: number;
  duration: number;
  cached: boolean;
  dependencyGraph?: {
    totalFiles: number;
    analyzedFiles: number;
    errorFiles: number;
    totalImports: number;
    maxDepth: number;
    actualMaxDepth: number;
  };
}

export interface RemoteAnalysisResponse {
  content: string;
  spec?: OpenPkgSpec;
  imports: RemoteAnalysisImport[];
  parseErrors?: ParseResult['errors'];
  metadata: RemoteAnalysisMetadata;
  files?: Record<string, string>;
}

export interface RemoteAnalysisRequestOptions {
  source: string;
  type?: 'url' | 'code';
  followImports?: boolean;
  maxDepth?: number;
  includePrivate?: boolean;
  openPkgOptions?: OpenPkgOptions;
}

export interface RemoteAnalysisDependencies {
  createOpenPkg?: (options: OpenPkgOptions) => OpenPkg;
  createImportResolver?: (options: ImportResolverOptions) => ImportResolver;
  parser?: ImportParser;
  fetchContent?: (url: string) => Promise<string>;
  cache?: RemoteCache;
}

export class RemoteAnalysisError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'RemoteAnalysisError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface AnalyzeContext {
  openpkg: OpenPkg;
  parser: ImportParser;
  fetcher: { fetch: (url: string) => Promise<string> };
  createResolver: (opts: ImportResolverOptions) => ImportResolver;
  cache: RemoteCache;
}

function createContext(
  options: RemoteAnalysisRequestOptions,
  dependencies: RemoteAnalysisDependencies = {},
): AnalyzeContext {
  const openpkgOptions: OpenPkgOptions = {
    includePrivate: options.includePrivate,
    followImports: false,
    maxDepth: options.maxDepth,
  };

  const fetcher = dependencies.fetchContent
    ? { fetch: dependencies.fetchContent }
    : new GitHubFetcher();

  const parser = dependencies.parser ?? new ImportParser();
  const cache = dependencies.cache ?? new InMemoryRemoteCache();

  const createResolver = dependencies.createImportResolver
    ? (resolverOptions: ImportResolverOptions) =>
        dependencies.createImportResolver!({ ...resolverOptions, fetcher, cache })
    : (resolverOptions: ImportResolverOptions) =>
        new ImportResolver({ ...resolverOptions, fetcher, cache });

  return {
    openpkg: dependencies.createOpenPkg
      ? dependencies.createOpenPkg({ ...openpkgOptions, ...options.openPkgOptions })
      : new OpenPkg({ ...openpkgOptions, ...options.openPkgOptions }),
    parser,
    fetcher,
    createResolver,
    cache,
  };
}

export async function analyzeRemote(
  options: RemoteAnalysisRequestOptions,
  dependencies: RemoteAnalysisDependencies = {},
): Promise<RemoteAnalysisResponse> {
  const start = Date.now();
  const type = options.type || (options.source.startsWith('http') ? 'url' : 'code');
  const context = createContext(options, dependencies);

  try {
    if (type === 'url') {
      return analyzeRemoteUrl(options, context, start);
    }

    return analyzeInlineCode(options, context, start);
  } catch (error) {
    if (error instanceof RemoteAnalysisError) {
      throw error;
    }
    if (error instanceof GitHubFetchError) {
      throw new RemoteAnalysisError(error.code, error.message, error.statusCode);
    }
    if (error instanceof Error) {
      throw new RemoteAnalysisError('ANALYSIS_FAILED', error.message);
    }
    throw new RemoteAnalysisError('ANALYSIS_FAILED', 'Unknown error occurred');
  }
}

async function analyzeRemoteUrl(
  options: RemoteAnalysisRequestOptions,
  context: AnalyzeContext,
  startTime: number,
): Promise<RemoteAnalysisResponse> {
  const followImports = options.followImports === true;

  if (followImports) {
    return analyzeWithImports(options, context, startTime);
  }

  const content = await fetchContent(context, options.source);
  const spec = await context.openpkg.analyze(content, options.source);
  const parseResult = context.parser.parse(content, options.source);

  return buildResponse({
    content,
    spec,
    parseResult,
    metadata: {
      filesAnalyzed: 1,
      duration: Date.now() - startTime,
      cached: false,
    },
  });
}

async function analyzeWithImports(
  options: RemoteAnalysisRequestOptions,
  context: AnalyzeContext,
  startTime: number,
): Promise<RemoteAnalysisResponse> {
  const resolver = context.createResolver({
    maxDepth: options.maxDepth ?? 5,
  });

  const resolveResult = await resolver.resolveImports(options.source);
 const filesObject = Object.fromEntries(resolveResult.files);
 const rootContent = resolveResult.files.get(options.source);

  if (!rootContent) {
    throw new RemoteAnalysisError('FILE_NOT_FOUND', 'Root file content could not be fetched');
  }

  const rootResult = await context.openpkg.analyze(rootContent, options.source);

  const additionalSpecs: OpenPkgSpec[] = [];
  const specMap = new Map<string, OpenPkgSpec>();

  for (const [fileUrl, fileContent] of resolveResult.files) {
    if (fileUrl === options.source) {
      continue;
    }

    try {
      const spec = await context.openpkg.analyze(fileContent, fileUrl);
      additionalSpecs.push(spec);
      specMap.set(fileUrl, spec);
    } catch (error) {
      console.warn(`Failed to analyze imported file ${fileUrl}:`, error);
    }
  }

  let mergedSpec = TypeMerger.mergeTypes(rootResult, additionalSpecs);

  const rootParse = context.parser.parse(rootContent, options.source);
  const reExports = rootParse.imports.filter((imp) => imp.isReExport);
  mergedSpec = ExportMerger.mergeExports(mergedSpec, specMap, reExports);

  const stats = resolveResult.graph.getStats();
  const metadata: RemoteAnalysisMetadata = {
    filesAnalyzed: stats.totalFiles,
    duration: Date.now() - startTime,
    cached: false,
    dependencyGraph: stats,
  };

  return buildResponse({
    content: rootContent,
    spec: mergedSpec,
    parseResult: rootParse,
    metadata,
    files: filesObject,
  });
}

async function analyzeInlineCode(
  options: RemoteAnalysisRequestOptions,
  context: AnalyzeContext,
  startTime: number,
): Promise<RemoteAnalysisResponse> {
  const content = options.source;
  const spec = await context.openpkg.analyze(content);
  const parseResult = context.parser.parse(content, 'inline.ts');

  return buildResponse({
    content,
    spec,
    parseResult,
    metadata: {
      filesAnalyzed: 1,
      duration: Date.now() - startTime,
      cached: false,
    },
  });
}

function buildResponse(input: {
  content: string;
  spec?: OpenPkgSpec;
  parseResult: ParseResult;
  metadata: RemoteAnalysisMetadata;
  files?: Record<string, string>;
}): RemoteAnalysisResponse {
  return {
    content: input.content,
    spec: input.spec,
    imports: input.parseResult.imports,
    parseErrors: input.parseResult.hasErrors ? input.parseResult.errors : undefined,
    metadata: input.metadata,
    files: input.files,
  };
}

async function fetchContent(context: AnalyzeContext, url: string): Promise<string> {
  const cacheKey = `file:${url}`;
  const cached = context.cache.get<string>(cacheKey);
  if (cached) {
    return cached.value;
  }

  const content = await context.fetcher.fetch(url);
  context.cache.set(cacheKey, content);
  return content;
}
