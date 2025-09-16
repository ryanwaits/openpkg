import { GitHubFetcher } from '../fetcher/github-fetcher';
import type { RemoteCache } from '../cache/cache';
import { ImportParser } from '../parser/import-parser';
import { RelativePathResolver } from './relative-path-resolver';
import { DependencyGraph, type DependencyGraphOptions } from './dependency-graph';

export interface ImportResolverOptions extends DependencyGraphOptions {
  onProgress?: (message: string, current: number, total: number) => void;
  fetcher?: {
    fetch: (url: string) => Promise<string>;
  };
  cache?: RemoteCache;
}

export interface ResolveResult {
  graph: DependencyGraph;
  files: Map<string, string>;
  errors: Array<{ url: string; error: string }>;
}

export class ImportResolver {
  private readonly fetcher: { fetch: (url: string) => Promise<string> };
  private readonly parser = new ImportParser();
  private readonly options: ImportResolverOptions;
  private readonly cache?: RemoteCache;

  constructor(options: ImportResolverOptions = {}) {
    this.options = options;
    this.fetcher = options.fetcher ?? new GitHubFetcher();
    this.cache = options.cache;
  }

  async resolveImports(rootUrl: string): Promise<ResolveResult> {
    const graph = new DependencyGraph(rootUrl, this.options);
    const resolvedFiles = new Map<string, string>();
    const errors: Array<{ url: string; error: string }> = [];

    const queue: string[] = [rootUrl];
    const processed = new Set<string>();

    while (queue.length > 0) {
      const url = queue.shift()!;
      if (processed.has(url)) {
        continue;
      }
      processed.add(url);

      if (this.options.onProgress) {
        this.options.onProgress(
          `Fetching ${url.split('/').pop() ?? url}...`,
          processed.size,
          processed.size + queue.length,
        );
      }

      try {
        const content = await this.fetchWithCache(url);
        resolvedFiles.set(url, content);

        const parseResult = this.parser.parse(content, url);
        const relativeImports = parseResult.imports.filter((imp) => imp.type === 'relative');
        const resolvedImports: string[] = [];

        for (const imp of relativeImports) {
          try {
            const possiblePaths = RelativePathResolver.resolvePossiblePaths(imp.path, url);
            let resolved = false;

            for (const possibleUrl of possiblePaths) {
              if (resolvedFiles.has(possibleUrl)) {
                resolvedImports.push(possibleUrl);
                resolved = true;
                break;
              }

              try {
                const fileContent = await this.fetchWithCache(possibleUrl);
                resolvedFiles.set(possibleUrl, fileContent);
                resolvedImports.push(possibleUrl);
                resolved = true;
                break;
              } catch {
                // Try next candidate
              }
            }

            if (!resolved) {
              errors.push({
                url: imp.path,
                error: `Could not resolve import "${imp.path}" from ${url}`,
              });
            }
          } catch (error) {
            errors.push({
              url: imp.path,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        graph.addFile(url, content, resolvedImports);

        for (const importUrl of resolvedImports) {
          if (processed.has(importUrl)) {
            continue;
          }

          if (graph.wouldCreateCycle(url, importUrl)) {
            errors.push({
              url: importUrl,
              error: `Circular dependency detected: ${url} -> ${importUrl}`,
            });
            continue;
          }

          if (graph.wouldExceedMaxDepth(url)) {
            continue;
          }

          queue.push(importUrl);
        }

        graph.markAnalyzed(url);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ url, error: message });
        graph.markError(url, message);
      }
    }

    return {
      graph,
      files: resolvedFiles,
      errors,
    };
  }

  private async fetchWithCache(url: string): Promise<string> {
    const cacheKey = `file:${url}`;
    const cached = this.cache?.get<string>(cacheKey);
    if (cached) {
      return cached.value;
    }

    const content = await this.fetcher.fetch(url);
    this.cache?.set(cacheKey, content);
    return content;
  }
}
