# OpenPkg SDK Usage Guide

## Overview

The OpenPkg SDK (`@openpkg/sdk`) provides a simple, powerful API for analyzing TypeScript code and generating OpenPkg specifications. This guide covers everything you need to integrate the SDK into your project.

## Installation

```bash
# Using bun
bun add @openpkg/sdk

# Using npm
npm install @openpkg/sdk

# Using yarn
yarn add @openpkg/sdk
```

## Quick Start

```typescript
import { OpenPkg } from '@openpkg/sdk';

// Create an instance
const openpkg = new OpenPkg();

// Analyze TypeScript code
const spec = await openpkg.analyze(`
  export function greet(name: string): string {
    return \`Hello, \${name}!\`;
  }
`);

console.log(spec.exports); // [{ name: 'greet', kind: 'function', ... }]
```

## Core API

### OpenPkg Class

The main class for all analysis operations.

```typescript
const openpkg = new OpenPkg(options?: OpenPkgOptions);
```

#### Options

```typescript
interface OpenPkgOptions {
  includePrivate?: boolean;  // Include private members (default: false)
  followImports?: boolean;   // Follow and analyze imports (default: true)
  maxDepth?: number;        // Max depth for type resolution (default: 10)
}
```

### Methods

#### `analyze(code: string, fileName?: string): Promise<OpenPkgSpec>`

Analyze TypeScript code from a string.

```typescript
const spec = await openpkg.analyze(`
  export interface User {
    id: number;
    name: string;
  }
`, 'user.ts');
```

#### `analyzeFile(filePath: string): Promise<OpenPkgSpec>`

Analyze a TypeScript file from disk.

```typescript
const spec = await openpkg.analyzeFile('./src/utils.ts');
```

#### `analyzeProject(entryPath: string): Promise<OpenPkgSpec>`

Analyze a TypeScript project starting from an entry file.

```typescript
const spec = await openpkg.analyzeProject('./src/index.ts');
```

#### `analyzeWithDiagnostics(code: string, fileName?: string): Promise<AnalysisResult>`

Get analysis results with diagnostics for debugging.

```typescript
const result = await openpkg.analyzeWithDiagnostics(code);
console.log(result.diagnostics); // TypeScript diagnostics
console.log(result.spec);        // OpenPkg specification
```

## Studio Integration Example

Here's how OpenPkg Studio uses the SDK:

```typescript
// studio/src/analyzer.ts
import { OpenPkg } from '@openpkg/sdk';

export class StudioAnalyzer {
  private sdk: OpenPkg;

  constructor() {
    this.sdk = new OpenPkg({
      includePrivate: false,
      followImports: true
    });
  }

  async analyzeFromUrl(url: string, content: string) {
    try {
      // Use the fileName parameter to help with import resolution
      const spec = await this.sdk.analyze(content, url);
      
      return {
        success: true,
        spec,
        metadata: {
          url,
          timestamp: new Date(),
          exportCount: spec.exports.length,
          typeCount: spec.types?.length || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        url
      };
    }
  }

  async analyzeWithImports(content: string, fileName: string) {
    // The SDK handles all the complex TypeScript parsing
    const result = await this.sdk.analyzeWithDiagnostics(content, fileName);
    
    // Check for errors
    if (result.diagnostics.length > 0) {
      console.warn('TypeScript diagnostics:', result.diagnostics);
    }
    
    return result.spec;
  }
}
```

## Working with Results

### OpenPkg Specification Structure

```typescript
interface OpenPkgSpec {
  openpkg: "1.0.0";                // Spec version
  meta: {
    name: string;
    version: string;
    description?: string;
    ecosystem: "js/ts";
  };
  exports: Export[];               // All exported items
  types?: TypeDefinition[];        // Type definitions
}

interface Export {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'enum';
  description?: string;
  signatures?: Signature[];        // For functions/methods
  type?: Schema;                   // For variables
  members?: Member[];              // For classes/interfaces
}
```

### Example: Processing Exports

```typescript
const spec = await openpkg.analyzeFile('./api.ts');

// Group exports by kind
const functions = spec.exports.filter(e => e.kind === 'function');
const classes = spec.exports.filter(e => e.kind === 'class');
const interfaces = spec.exports.filter(e => e.kind === 'interface');

// Generate documentation
functions.forEach(fn => {
  console.log(`### ${fn.name}`);
  if (fn.description) {
    console.log(fn.description);
  }
  fn.signatures?.forEach(sig => {
    const params = sig.parameters?.map(p => `${p.name}: ${formatType(p.schema)}`).join(', ');
    const returns = sig.returns ? formatType(sig.returns.schema) : 'void';
    console.log(`\`${fn.name}(${params}): ${returns}\``);
  });
});
```

## Advanced Usage

### Custom Options

```typescript
const openpkg = new OpenPkg({
  includePrivate: true,    // Include private class members
  followImports: false,    // Don't analyze imported files
  maxDepth: 5              // Limit type resolution depth
});
```

### Handling In-Memory Files

The SDK can analyze code that doesn't exist on disk:

```typescript
// Perfect for analyzing code from URLs, databases, or user input
const virtualFile = `
  import { BaseClass } from './base'; // This import will be ignored
  
  export class MyClass extends BaseClass {
    constructor(public name: string) {
      super();
    }
  }
`;

const spec = await openpkg.analyze(virtualFile, 'virtual://myclass.ts');
```

### Error Handling

```typescript
try {
  const spec = await openpkg.analyzeFile('./missing.ts');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('File not found');
  } else if (error.message.includes('TypeScript')) {
    console.error('TypeScript parsing error:', error.message);
  }
}
```

## Integration Tips

### 1. Caching Results

```typescript
const cache = new Map<string, OpenPkgSpec>();

async function analyzeWithCache(url: string, content: string) {
  const cacheKey = `${url}:${hashContent(content)}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const spec = await openpkg.analyze(content, url);
  cache.set(cacheKey, spec);
  return spec;
}
```

### 2. Batch Processing

```typescript
async function analyzeMultipleFiles(files: string[]) {
  const openpkg = new OpenPkg();
  
  const results = await Promise.all(
    files.map(async file => {
      try {
        const spec = await openpkg.analyzeFile(file);
        return { file, spec, success: true };
      } catch (error) {
        return { file, error: error.message, success: false };
      }
    })
  );
  
  return results;
}
```

### 3. Streaming Analysis (Future)

```typescript
// Note: This is a planned feature
// const stream = openpkg.analyzeStream('./src/**/*.ts');
// for await (const result of stream) {
//   console.log(`Analyzed ${result.file}: ${result.exports.length} exports`);
// }
```

## Common Patterns

### Analyzing GitHub Files

```typescript
async function analyzeGitHubFile(url: string) {
  // Fetch the raw content
  const content = await fetch(url.replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/')).then(r => r.text());
  
  // Use the URL as the fileName for better import resolution
  const spec = await openpkg.analyze(content, url);
  return spec;
}
```

### Filtering Exports

```typescript
// Only public API
const publicAPI = spec.exports.filter(exp => 
  !exp.name.startsWith('_') && 
  exp.kind !== 'variable'
);

// Only types and interfaces
const types = spec.exports.filter(exp => 
  ['interface', 'type', 'enum'].includes(exp.kind)
);
```

### Generating API Documentation

```typescript
function generateMarkdown(spec: OpenPkgSpec): string {
  let md = `# ${spec.meta.name} API\n\n`;
  
  spec.exports.forEach(exp => {
    md += `## ${exp.name}\n`;
    md += `**Kind**: ${exp.kind}\n\n`;
    
    if (exp.description) {
      md += `${exp.description}\n\n`;
    }
    
    if (exp.signatures) {
      exp.signatures.forEach(sig => {
        md += '```typescript\n';
        md += formatSignature(exp.name, sig);
        md += '\n```\n\n';
      });
    }
  });
  
  return md;
}
```

## Known Limitations

### Anonymous Object Types

When TypeScript encounters complex object types (like function return values that are object literals), it may assign internal names like `__object`. In these cases, the SDK will return either:
- An expanded object schema with all properties (when possible)
- A generic `{ type: 'object' }` schema (when properties cannot be determined)

This commonly happens with:
- Factory functions returning object literals
- Complex intersection types
- Dynamically created objects

Example:
```typescript
// This might produce an anonymous type
export const client = createClient()  // type: { type: 'object' }
```

## Troubleshooting

### Common Issues

1. **Missing type information**
   - Ensure TypeScript is installed in your project
   - Check that declaration files (.d.ts) are available

2. **Import resolution failures**
   - Provide accurate fileName parameter
   - Consider using `followImports: false` for isolated analysis

3. **Performance issues**
   - Use `maxDepth` to limit type resolution
   - Consider caching results for repeated analysis

## API Reference

### Types

```typescript
export interface OpenPkgOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
}

export interface AnalysisResult {
  spec: OpenPkgSpec;
  diagnostics: Diagnostic[];
}

export type OpenPkgSpec = {
  openpkg: "1.0.0";
  meta: MetaInfo;
  exports: Export[];
  types?: TypeDefinition[];
}
```

### Convenience Functions

For one-off usage without creating an instance:

```typescript
import { analyze, analyzeFile } from '@openpkg/sdk';

// Quick analysis
const spec = await analyze('export const PI = 3.14;');

// Quick file analysis
const spec = await analyzeFile('./constants.ts');
```

## Migration from Direct Usage

If you were previously using the extractor directly:

```typescript
// Before (direct extractor usage)
import { extractPackageSpec } from './extractor';
const spec = await extractPackageSpec(entryFile, packageDir);

// After (using SDK)
import { OpenPkg } from '@openpkg/sdk';
const openpkg = new OpenPkg();
const spec = await openpkg.analyzeFile(entryFile);
```

## Next Steps

- Check out the [examples](../examples) directory for more usage patterns
- Read the [API documentation](./api.md) for detailed type information
- See [integration guide](./integration.md) for framework-specific examples

## Support

For issues or questions:
- GitHub Issues: https://github.com/openpkg/openpkg/issues
- Documentation: https://openpkg.dev/docs