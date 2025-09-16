import * as path from 'node:path';

export class RelativePathResolver {
  static resolve(importPath: string, baseUrl: string): string {
    const urlParts = this.parseGitHubUrl(baseUrl);
    if (!urlParts) {
      throw new Error(`Invalid GitHub URL: ${baseUrl}`);
    }

    const { owner, repo, branch, filePath } = urlParts;
    const baseDir = path.dirname(filePath);
    let resolvedPath = path.join(baseDir, importPath);

    if (!this.hasExtension(resolvedPath) && !this.hasTsExtension(resolvedPath)) {
      resolvedPath = `${resolvedPath}.ts`;
    }

    resolvedPath = path.normalize(resolvedPath);

    if (resolvedPath.startsWith('../')) {
      throw new Error(`Import path "${importPath}" escapes repository root`);
    }

    return `https://github.com/${owner}/${repo}/blob/${branch}/${resolvedPath}`;
  }

  static resolvePossiblePaths(importPath: string, baseUrl: string): string[] {
    const urlParts = this.parseGitHubUrl(baseUrl);

    if (!urlParts) {
      throw new Error(`Invalid GitHub URL: ${baseUrl}`);
    }

    const { owner, repo, branch, filePath } = urlParts;
    const baseDir = path.dirname(filePath);
    const resolvedBase = path.join(baseDir, importPath);
    const normalizedBase = path.normalize(resolvedBase);

    if (normalizedBase.startsWith('../')) {
      throw new Error(`Import path "${importPath}" escapes repository root`);
    }

    const possibilities: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    if (this.hasTsExtension(normalizedBase)) {
      possibilities.push(normalizedBase);
    } else {
      for (const ext of extensions) {
        possibilities.push(`${normalizedBase}${ext}`);
      }

      for (const ext of extensions) {
        possibilities.push(path.join(normalizedBase, `index${ext}`));
      }
    }

    return possibilities.map(
      (p) => `https://github.com/${owner}/${repo}/blob/${branch}/${p}`,
    );
  }

  static toRawUrl(githubUrl: string): string {
    const parts = this.parseGitHubUrl(githubUrl);
    if (!parts) {
      throw new Error(`Invalid GitHub URL: ${githubUrl}`);
    }

    const { owner, repo, branch, filePath } = parts;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }

  private static parseGitHubUrl(url: string): {
    owner: string;
    repo: string;
    branch: string;
    filePath: string;
  } | null {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/);
    if (!match) {
      return null;
    }

    return {
      owner: match[1],
      repo: match[2],
      branch: match[3],
      filePath: match[4],
    };
  }

  private static hasExtension(filePath: string): boolean {
    return /\.[^\/]+$/.test(filePath);
  }

  private static hasTsExtension(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath);
  }
}
