export interface FileNode {
  url: string;
  content: string;
  imports: string[];
  analyzed: boolean;
  error?: string;
  depth?: number;
}

export interface DependencyGraphOptions {
  maxDepth?: number;
  maxFiles?: number;
}

export class DependencyGraph {
  private readonly nodes = new Map<string, FileNode>();
  private readonly edges = new Map<string, Set<string>>();
  private readonly rootUrl: string;
  private readonly options: Required<DependencyGraphOptions>;
  private actualMaxDepth = 0;

  constructor(rootUrl: string, options: DependencyGraphOptions = {}) {
    this.rootUrl = rootUrl;
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      maxFiles: options.maxFiles ?? 100,
    };
  }

  addFile(url: string, content: string, imports: string[] = []): void {
    if (this.nodes.size >= this.options.maxFiles) {
      throw new Error(`Maximum file limit (${this.options.maxFiles}) reached`);
    }

    const depth = this.calculateDepthFromRoot(url);

    this.nodes.set(url, {
      url,
      content,
      imports,
      analyzed: false,
      depth,
    });

    if (imports.length > 0) {
      this.edges.set(url, new Set(imports));
    }

    if (depth > this.actualMaxDepth) {
      this.actualMaxDepth = depth;
    }
  }

  markAnalyzed(url: string): void {
    const node = this.nodes.get(url);
    if (node) {
      node.analyzed = true;
    }
  }

  markError(url: string, error: string): void {
    const node = this.nodes.get(url);
    if (node) {
      node.error = error;
      node.analyzed = true;
    }
  }

  hasFile(url: string): boolean {
    return this.nodes.has(url);
  }

  getFile(url: string): FileNode | undefined {
    return this.nodes.get(url);
  }

  wouldCreateCycle(fromUrl: string, toUrl: string): boolean {
    if (fromUrl === toUrl) {
      return true;
    }

    const visited = new Set<string>();
    const queue = [toUrl];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === fromUrl) {
        return true;
      }

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const imports = this.edges.get(current);
      if (imports) {
        queue.push(...imports);
      }
    }

    return false;
  }

  wouldExceedMaxDepth(fromUrl: string): boolean {
    const node = this.nodes.get(fromUrl);
    if (!node || node.depth === undefined) {
      return false;
    }
    return node.depth >= this.options.maxDepth;
  }

  getAllFiles(): FileNode[] {
    return Array.from(this.nodes.values());
  }

  getStats(): {
    totalFiles: number;
    analyzedFiles: number;
    errorFiles: number;
    totalImports: number;
    maxDepth: number;
    actualMaxDepth: number;
  } {
    const allFiles = this.getAllFiles();
    return {
      totalFiles: allFiles.length,
      analyzedFiles: allFiles.filter((file) => file.analyzed).length,
      errorFiles: allFiles.filter((file) => file.error).length,
      totalImports: Array.from(this.edges.values()).reduce((sum, imports) => sum + imports.size, 0),
      maxDepth: this.options.maxDepth,
      actualMaxDepth: this.actualMaxDepth,
    };
  }

  private calculateDepthFromRoot(url: string): number {
    if (url === this.rootUrl) {
      return 0;
    }

    let minDepth = Infinity;

    for (const [from, imports] of this.edges.entries()) {
      if (imports.has(url)) {
        const fromNode = this.nodes.get(from);
        if (fromNode && fromNode.depth !== undefined) {
          minDepth = Math.min(minDepth, fromNode.depth + 1);
        }
      }
    }

    return minDepth === Infinity ? 0 : minDepth;
  }
}
