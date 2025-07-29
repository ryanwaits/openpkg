import * as ts from 'typescript';
import * as crypto from 'crypto';
import { ResolvedType } from './type-resolver';
import { logger } from '../utils/logger';

/**
 * Caching service for type resolution to improve performance
 */
export class TypeCache {
  private typeCache = new Map<string, CachedType>();
  private symbolCache = new Map<string, CachedSymbol>();
  private fileCache = new Map<string, CachedFile>();
  private maxCacheSize: number;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(maxCacheSize = 10000) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Get or compute resolved type with caching
   */
  getOrResolveType(
    node: ts.Node,
    resolver: () => ResolvedType
  ): ResolvedType {
    const cacheKey = this.getNodeCacheKey(node);
    
    const cached = this.typeCache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      this.cacheHits++;
      logger.cache('hit', cacheKey);
      return cached.resolvedType;
    }

    this.cacheMisses++;
    logger.cache('miss', cacheKey);
    const resolvedType = resolver();
    
    this.setCachedType(cacheKey, resolvedType);
    logger.cache('store', cacheKey);
    return resolvedType;
  }

  /**
   * Cache a resolved type
   */
  setCachedType(key: string, resolvedType: ResolvedType): void {
    if (this.typeCache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }

    this.typeCache.set(key, {
      resolvedType,
      timestamp: Date.now(),
      accessCount: 0
    });
  }

  /**
   * Get or compute symbol information with caching
   */
  getOrResolveSymbol<T>(
    symbol: ts.Symbol,
    resolver: () => T
  ): T {
    const cacheKey = this.getSymbolCacheKey(symbol);
    
    const cached = this.symbolCache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      this.cacheHits++;
      cached.accessCount++;
      return cached.data as T;
    }

    this.cacheMisses++;
    const data = resolver();
    
    this.setCachedSymbol(cacheKey, data);
    return data;
  }

  /**
   * Cache symbol information
   */
  setCachedSymbol(key: string, data: any): void {
    if (this.symbolCache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }

    this.symbolCache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0
    });
  }

  /**
   * Cache file analysis results
   */
  cacheFileAnalysis(fileName: string, analysis: FileAnalysis): void {
    this.fileCache.set(fileName, {
      analysis,
      timestamp: Date.now(),
      fileHash: this.getFileHash(fileName)
    });
  }

  /**
   * Get cached file analysis
   */
  getCachedFileAnalysis(fileName: string): FileAnalysis | null {
    const cached = this.fileCache.get(fileName);
    
    if (!cached) {
      return null;
    }

    // Check if file has changed
    const currentHash = this.getFileHash(fileName);
    if (cached.fileHash !== currentHash) {
      this.fileCache.delete(fileName);
      return null;
    }

    return cached.analysis;
  }

  /**
   * Generate cache key for a node
   */
  private getNodeCacheKey(node: ts.Node): string {
    const sourceFile = node.getSourceFile();
    const start = node.getStart();
    const end = node.getEnd();
    const kind = node.kind;
    
    return `${sourceFile.fileName}:${kind}:${start}:${end}`;
  }

  /**
   * Generate cache key for a symbol
   */
  private getSymbolCacheKey(symbol: ts.Symbol): string {
    const name = symbol.getName();
    const flags = symbol.flags;
    
    // Include declaration location for uniqueness
    if (symbol.declarations && symbol.declarations.length > 0) {
      const decl = symbol.declarations[0];
      const sourceFile = decl.getSourceFile();
      const start = decl.getStart();
      return `${name}:${flags}:${sourceFile.fileName}:${start}`;
    }
    
    return `${name}:${flags}`;
  }

  /**
   * Get file hash for change detection
   */
  private getFileHash(fileName: string): string {
    try {
      const content = ts.sys.readFile(fileName) || '';
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: { timestamp: number }): boolean {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return Date.now() - entry.timestamp > maxAge;
  }

  /**
   * Evict oldest cache entries when size limit is reached
   */
  private evictOldestEntries(): void {
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.2); // Remove 20%
    
    // Sort by access count and timestamp
    const sortedTypeEntries = Array.from(this.typeCache.entries())
      .sort((a, b) => {
        const aScore = a[1].accessCount + (Date.now() - a[1].timestamp) / 1000;
        const bScore = b[1].accessCount + (Date.now() - b[1].timestamp) / 1000;
        return aScore - bScore;
      });

    // Remove least recently used
    for (let i = 0; i < entriesToRemove && i < sortedTypeEntries.length; i++) {
      this.typeCache.delete(sortedTypeEntries[i][0]);
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.typeCache.clear();
    this.symbolCache.clear();
    this.fileCache.clear();
    this.resetStats();
  }

  /**
   * Clear cache for a specific file
   */
  clearFile(fileName: string): void {
    // Remove all type cache entries for this file
    const keysToDelete: string[] = [];
    
    for (const [key, _] of this.typeCache) {
      if (key.startsWith(fileName + ':')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.typeCache.delete(key));
    
    // Remove file cache
    this.fileCache.delete(fileName);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      typesCached: this.typeCache.size,
      symbolsCached: this.symbolCache.size,
      filesCached: this.fileCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      totalSize: this.typeCache.size + this.symbolCache.size
    };
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Warm up cache by pre-analyzing common types
   */
  warmUp(sourceFiles: ts.SourceFile[], typeChecker: ts.TypeChecker): void {
    for (const sourceFile of sourceFiles) {
      this.warmUpFile(sourceFile, typeChecker);
    }
  }

  private warmUpFile(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): void {
    const visit = (node: ts.Node) => {
      // Cache commonly accessed node types
      if (ts.isInterfaceDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isFunctionDeclaration(node)) {
        
        const type = typeChecker.getTypeAtLocation(node);
        const symbol = typeChecker.getSymbolAtLocation(node.name || node);
        
        // Pre-cache symbol info
        if (symbol) {
          const cacheKey = this.getSymbolCacheKey(symbol);
          this.setCachedSymbol(cacheKey, {
            name: symbol.getName(),
            flags: symbol.flags,
            declarations: symbol.declarations?.length || 0
          });
        }
        
        // Pre-cache basic type info
        const nodeKey = this.getNodeCacheKey(node);
        this.setCachedType(nodeKey, {
          typeString: typeChecker.typeToString(type),
          isGeneric: false,
          isUnion: false,
          isIntersection: false,
          isArray: false,
          isPrimitive: false,
          isObject: true,
          isFunction: ts.isFunctionDeclaration(node)
        });
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
  }
}

interface CachedType {
  resolvedType: ResolvedType;
  timestamp: number;
  accessCount: number;
}

interface CachedSymbol {
  data: any;
  timestamp: number;
  accessCount: number;
}

interface CachedFile {
  analysis: FileAnalysis;
  timestamp: number;
  fileHash: string;
}

export interface FileAnalysis {
  exports: string[];
  imports: string[];
  types: string[];
  functions: string[];
  classes: string[];
}

export interface CacheStats {
  typesCached: number;
  symbolsCached: number;
  filesCached: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalSize: number;
}