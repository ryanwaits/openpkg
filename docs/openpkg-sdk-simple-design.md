# OpenPkg SDK - Simple Design

## Core Philosophy

Following Linear's SDK design principles:
- **Simple by default** - One line to get started
- **Progressive disclosure** - Advanced features available when needed
- **Intuitive naming** - Methods do what you expect
- **Minimal configuration** - Smart defaults for everything

## Basic Usage

### Installation

```bash
bun add @openpkg/sdk
```

### Simple API

```typescript
import { OpenPkg } from '@openpkg/sdk';

// Initialize (no config needed for basic usage)
const openpkg = new OpenPkg();

// Analyze a single file
const spec = await openpkg.analyzeFile(filePath);

// Analyze from string content
const spec = await openpkg.analyze(codeString);

// Analyze a project
const spec = await openpkg.analyzeProject('./src');
```

## Core API Design

```typescript
// packages/sdk/src/index.ts

export class OpenPkg {
  constructor(options?: OpenPkgOptions) {
    // Optional configuration with smart defaults
    this.options = {
      includePrivate: false,
      followImports: true,
      ...options
    };
  }

  /**
   * Analyze TypeScript code from a string
   */
  async analyze(code: string, fileName = 'temp.ts'): Promise<OpenPkgSpec> {
    const result = await this.analyzeWithDiagnostics(code, fileName);
    return result.spec;
  }

  /**
   * Analyze a single file from disk
   */
  async analyzeFile(filePath: string): Promise<OpenPkgSpec> {
    const content = await readFile(filePath, 'utf-8');
    return this.analyze(content, filePath);
  }

  /**
   * Analyze a project directory
   */
  async analyzeProject(entryPath: string): Promise<OpenPkgSpec> {
    const project = await this.loadProject(entryPath);
    const result = await this.analyzeProjectWithDiagnostics(project);
    return result.spec;
  }

  /**
   * Parse imports without full analysis (fast)
   */
  async parseImports(code: string): Promise<Import[]> {
    return this.parser.parseImports(code);
  }

  /**
   * Get diagnostics along with the spec
   */
  async analyzeWithDiagnostics(code: string, fileName?: string): Promise<AnalysisResult> {
    // Full analysis with diagnostics
    return this.analyzer.analyze({ code, fileName });
  }
}

// Convenience functions for one-off usage
export async function analyze(code: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyze(code);
}

export async function analyzeFile(filePath: string): Promise<OpenPkgSpec> {
  return new OpenPkg().analyzeFile(filePath);
}
```

## Types (Simple & Clear)

```typescript
// packages/sdk/src/types.ts

export interface OpenPkgOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
}

export interface OpenPkgSpec {
  version: string;
  name: string;
  exports: Export[];
  types: Type[];
}

export interface Export {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'enum';
  description?: string;
  signatures?: Signature[];
  type?: string;
}

export interface Type {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  properties?: Property[];
  members?: EnumMember[];
}

export interface Import {
  from: string;
  type: 'relative' | 'package';
  imports: string[];
}

export interface AnalysisResult {
  spec: OpenPkgSpec;
  diagnostics: Diagnostic[];
  imports: Import[];
}
```

## Real-World Examples

### CLI Usage

```typescript
// packages/cli/src/commands/analyze.ts
import { OpenPkg } from '@openpkg/sdk';

export async function analyzeCommand(file: string, options: any) {
  const openpkg = new OpenPkg({
    includePrivate: options.all
  });

  try {
    const spec = await openpkg.analyzeFile(file);
    await writeFile('openpkg.json', JSON.stringify(spec, null, 2));
    console.log(`✓ Generated openpkg.json with ${spec.exports.length} exports`);
  } catch (error) {
    console.error(`Failed to analyze ${file}:`, error.message);
  }
}
```

### Studio Usage

```typescript
// openpkg-studio/src/analyzer.ts
import { OpenPkg } from '@openpkg/sdk';

const openpkg = new OpenPkg();

export async function analyzeFromUrl(url: string, content: string) {
  // Direct and simple
  const spec = await openpkg.analyze(content, url);
  
  return {
    spec,
    url,
    timestamp: new Date()
  };
}
```

### React Component

```typescript
import { OpenPkg } from '@openpkg/sdk';
import { useState } from 'react';

function CodeAnalyzer() {
  const [spec, setSpec] = useState(null);
  const openpkg = new OpenPkg();

  const handleAnalyze = async (code: string) => {
    const result = await openpkg.analyze(code);
    setSpec(result);
  };

  return (
    <div>
      <textarea onChange={(e) => handleAnalyze(e.target.value)} />
      {spec && <div>Found {spec.exports.length} exports</div>}
    </div>
  );
}
```

### GitHub Action

```typescript
import { OpenPkg } from '@openpkg/sdk';

async function run() {
  const openpkg = new OpenPkg();
  
  const spec = await openpkg.analyzeProject('./src');
  
  // Post comment with summary
  await github.createComment({
    body: `📦 OpenPkg Analysis: ${spec.exports.length} exports found`
  });
}
```

## Advanced Usage (When Needed)

### Custom Analysis

```typescript
// Still simple, but more control when needed
const openpkg = new OpenPkg({
  includePrivate: true,
  maxDepth: 3
});

// Get full analysis results
const result = await openpkg.analyzeWithDiagnostics(code);

if (result.diagnostics.length > 0) {
  console.warn('Issues found:', result.diagnostics);
}

// Just parse imports (fast)
const imports = await openpkg.parseImports(code);
```

### Batch Analysis

```typescript
// Analyze multiple files
const specs = await Promise.all(
  files.map(file => openpkg.analyzeFile(file))
);

// Or use the built-in batch method
const projectSpec = await openpkg.analyzeFiles(files);
```

### Streaming for Large Projects

```typescript
// Progressive analysis
const stream = openpkg.analyzeStream('./src/**/*.ts');

for await (const file of stream) {
  console.log(`Analyzed ${file.path}: ${file.exports.length} exports`);
}
```

## SDK Implementation Structure

```
packages/sdk/
├── src/
│   ├── index.ts         # Main OpenPkg class
│   ├── types.ts         # Simple type definitions
│   ├── analyzer.ts      # Core analysis logic
│   ├── parser.ts        # Import/export parsing
│   └── utils.ts         # Helper functions
├── package.json
└── README.md
```

## Key Differences from Complex Design

1. **Single entry point** - Just `OpenPkg` class, not multiple factories
2. **Method names match intent** - `analyzeFile()` not `createAnalyzer().analyze()`
3. **Smart defaults** - Works without configuration
4. **Progressive disclosure** - Advanced features available but not required
5. **Predictable API** - All analyze methods return `OpenPkgSpec`
6. **No setup required** - Import and use immediately

## Migration Path

```typescript
// Week 1: Move core logic to SDK
export { extractPackageSpec } from './extractor';  // Current CLI code
export { OpenPkg } from './sdk';                    // New simple API

// Week 2: Update CLI to use SDK
import { OpenPkg } from '@openpkg/sdk';
const spec = await new OpenPkg().analyzeFile(file);

// Week 3: Update Studio
import { OpenPkg } from '@openpkg/sdk';
const spec = await new OpenPkg().analyze(content);
```

## Benefits

- **Easy to learn** - Can understand in 30 seconds
- **Easy to use** - One line to get started
- **Flexible** - Handles simple and complex use cases
- **Maintainable** - Clear, simple codebase
- **Compatible** - Works in any JavaScript environment

This design prioritizes developer experience while maintaining all the power needed for complex use cases.