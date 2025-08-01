# OpenPkg SDK Implementation Plan

## Executive Summary

This document outlines the plan to refactor OpenPkg into a monorepo architecture with a shared SDK package. This will eliminate code duplication between the CLI and Studio projects, ensure consistency, and provide a robust foundation for future development.

## Current Problems

1. **Code Duplication**: Studio is recreating extraction logic that already exists in the CLI
2. **Maintenance Burden**: Bug fixes and improvements must be applied in multiple places
3. **Inconsistency Risk**: Different implementations may produce different results
4. **Limited Reusability**: Other projects cannot easily consume OpenPkg functionality

## Proposed Solution: Monorepo with SDK

### Monorepo Structure

```
openpkg/
├── packages/
│   ├── sdk/                 # Core OpenPkg functionality
│   │   ├── src/
│   │   │   ├── analyzer/    # Type analysis logic
│   │   │   ├── extractor/   # Export extraction
│   │   │   ├── parser/      # TypeScript parsing
│   │   │   ├── generator/   # Spec generation
│   │   │   ├── types/       # Shared types
│   │   │   └── index.ts     # Public API
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                 # CLI application
│       ├── src/
│       │   ├── commands/
│       │   ├── utils/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── package.json             # Root package.json
├── bun.lockb               # Shared lockfile
└── tsconfig.json           # Base TypeScript config
```

## SDK API Design

### Core Interfaces

```typescript
// packages/sdk/src/types/index.ts

export interface AnalyzeOptions {
  // Parser options
  includePrivate?: boolean;
  maxDepth?: number;
  followImports?: boolean;
  
  // Type checking options
  skipTypeChecking?: boolean;
  lib?: string[];
  
  // Output options
  includeSourceInfo?: boolean;
  includeTags?: boolean;
}

export interface AnalyzeResult {
  spec: OpenPkgSpec;
  diagnostics: Diagnostic[];
  metadata: {
    filesAnalyzed: number;
    duration: number;
    typeCheckingEnabled: boolean;
  };
}

export interface FileInput {
  path: string;
  content: string;
}

export interface ProjectInput {
  entryFile: string;
  files: Map<string, string>; // path -> content
  tsConfig?: any;
}
```

### Main SDK API

```typescript
// packages/sdk/src/index.ts

export class OpenPkgSDK {
  private analyzer: Analyzer;
  private options: AnalyzeOptions;

  constructor(options: AnalyzeOptions = {}) {
    this.options = options;
    this.analyzer = new Analyzer(options);
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(input: FileInput): Promise<AnalyzeResult> {
    const project = this.createSingleFileProject(input);
    return this.analyzer.analyze(project);
  }

  /**
   * Analyze a project with multiple files
   */
  async analyzeProject(input: ProjectInput): Promise<AnalyzeResult> {
    return this.analyzer.analyze(input);
  }

  /**
   * Parse imports from a file without full analysis
   */
  async parseImports(content: string, fileName?: string): Promise<ImportInfo[]> {
    const parser = new ImportParser();
    return parser.parse(content, fileName);
  }

  /**
   * Validate an OpenPkg spec
   */
  validateSpec(spec: unknown): OpenPkgSpec {
    return openPkgSchema.parse(spec);
  }

  /**
   * Get exports from TypeScript AST node
   */
  extractExports(sourceFile: ts.SourceFile): ExportInfo[] {
    const extractor = new ExportExtractor();
    return extractor.extract(sourceFile);
  }
}

// Convenience functions for simple use cases
export async function analyzeFile(
  path: string, 
  content: string, 
  options?: AnalyzeOptions
): Promise<OpenPkgSpec> {
  const sdk = new OpenPkgSDK(options);
  const result = await sdk.analyzeFile({ path, content });
  return result.spec;
}

export async function analyzeProject(
  entryFile: string,
  files: Map<string, string>,
  options?: AnalyzeOptions  
): Promise<OpenPkgSpec> {
  const sdk = new OpenPkgSDK(options);
  const result = await sdk.analyzeProject({ entryFile, files });
  return result.spec;
}
```

### Internal Architecture

```typescript
// packages/sdk/src/analyzer/index.ts

export class Analyzer {
  private typeChecker: TypeChecker;
  private extractor: Extractor;
  private generator: SpecGenerator;

  async analyze(input: ProjectInput): Promise<AnalyzeResult> {
    // 1. Create TypeScript program
    const program = this.createProgram(input);
    
    // 2. Extract exports and types
    const extraction = this.extractor.extract(program);
    
    // 3. Generate OpenPkg spec
    const spec = this.generator.generate(extraction);
    
    // 4. Collect diagnostics
    const diagnostics = this.collectDiagnostics(program);
    
    return {
      spec,
      diagnostics,
      metadata: this.createMetadata()
    };
  }
}
```

## Usage Examples

### CLI Usage

```typescript
// packages/cli/src/commands/analyze.ts

import { OpenPkgSDK } from '@openpkg/sdk';
import * as fs from 'fs';

export async function analyzeCommand(filePath: string, options: any) {
  const sdk = new OpenPkgSDK({
    includePrivate: options.includePrivate,
    followImports: options.followImports,
  });

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = await sdk.analyzeFile({
    path: filePath,
    content
  });

  if (result.diagnostics.length > 0) {
    console.warn('Warnings:', result.diagnostics);
  }

  fs.writeFileSync('openpkg.json', JSON.stringify(result.spec, null, 2));
}
```

### Studio Usage

```typescript
// openpkg-studio/src/core/analyzer/sdk-analyzer.ts

import { OpenPkgSDK } from '@openpkg/sdk';

export class StudioAnalyzer {
  private sdk: OpenPkgSDK;

  constructor() {
    this.sdk = new OpenPkgSDK({
      includeSourceInfo: true,
      includeTags: true,
    });
  }

  async analyzeFromUrl(url: string, content: string): Promise<AnalyzeResult> {
    // Use SDK for core analysis
    const result = await this.sdk.analyzeFile({
      path: url,
      content
    });

    // Add Studio-specific metadata
    return {
      ...result,
      studioMetadata: {
        url,
        fetchedAt: new Date().toISOString(),
      }
    };
  }
}
```

### Third-party Usage

```typescript
// some-other-project/analyze.ts

import { analyzeFile } from '@openpkg/sdk';

const spec = await analyzeFile('utils.ts', fileContent, {
  includePrivate: false
});

console.log(`Found ${spec.exports.length} exports`);
```

## Migration Strategy

### Phase 1: Setup Monorepo (1-2 days)
1. Create monorepo structure in openpkg
2. Move existing CLI code to `packages/cli`
3. Set up build tooling (turbo/nx/lerna or Bun workspaces)
4. Ensure CLI still works as before

### Phase 2: Extract SDK (3-4 days)
1. Create `packages/sdk` directory
2. Move core logic from CLI to SDK:
   - `extractor.ts` → `sdk/src/extractor/`
   - `types/openpkg.ts` → `sdk/src/types/`
   - Utils → `sdk/src/utils/`
3. Create public API in `sdk/src/index.ts`
4. Update CLI to use SDK

### Phase 3: Update Studio (2-3 days)
1. Remove duplicated code from Studio
2. Add `@openpkg/sdk` as dependency
3. Update analyzers to use SDK
4. Test end-to-end functionality

### Phase 4: Enhance SDK (ongoing)
1. Add more sophisticated type analysis
2. Implement caching layer
3. Add plugin system
4. Improve performance

## Benefits

1. **Single Source of Truth**: One implementation of core logic
2. **Consistency**: CLI and Studio produce identical results
3. **Maintainability**: Bug fixes and improvements in one place
4. **Reusability**: Other projects can use OpenPkg functionality
5. **Testing**: Shared test suite for core functionality
6. **Type Safety**: Shared TypeScript types across projects

## SDK Package Configuration

```json
// packages/sdk/package.json
{
  "name": "@openpkg/sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.js",
      "types": "./dist/types/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src"
  },
  "dependencies": {
    "typescript": "^5.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Alternative Approaches Considered

### 1. Git Submodules
- **Pros**: Keeps repos separate
- **Cons**: Complex to manage, version synchronization issues

### 2. Copy Shared Code
- **Pros**: Simple
- **Cons**: Exactly the problem we're trying to solve

### 3. Publish Private NPM Package
- **Pros**: Standard npm workflow
- **Cons**: Requires private registry, slower iteration

### 4. Monorepo (Chosen)
- **Pros**: Atomic commits, easier refactoring, shared tooling
- **Cons**: Larger repo, need monorepo tooling

## Open Questions

1. **Monorepo Tool**: Nx, Lerna, Turbo, or Bun workspaces?
2. **Publishing Strategy**: Publish SDK to npm immediately or keep private initially?
3. **Breaking Changes**: How to handle API changes during migration?
4. **Performance**: Should SDK support streaming for large projects?
5. **Plugins**: Should SDK support plugins for custom extractors?

## Next Steps

1. Review and approve this plan
2. Set up monorepo structure in openpkg
3. Begin Phase 1 migration
4. Create detailed SDK API documentation
5. Write migration guide for Studio

## Success Criteria

- [ ] CLI works identically after migration
- [ ] Studio can remove all duplicated extraction code
- [ ] SDK can be used standalone
- [ ] All tests pass
- [ ] Performance is not degraded
- [ ] Documentation is complete