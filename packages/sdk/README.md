# OpenPkg SDK

[![npm version](https://img.shields.io/npm/v/openpkg-sdk.svg)](https://www.npmjs.com/package/openpkg-sdk)

TypeScript SDK for programmatically generating OpenPkg specifications.

## Installation

```bash
# Using npm
npm install openpkg-sdk

# Using bun
bun add openpkg-sdk

# Using yarn  
yarn add openpkg-sdk

# Using pnpm
pnpm add openpkg-sdk
```

## Basic Usage

```typescript
import { OpenPkg } from 'openpkg-sdk';

// Create an instance
const openpkg = new OpenPkg();

// Analyze a TypeScript file
const spec = await openpkg.analyzeFile('./src/index.ts');

// Access the specification
console.log(`Found ${spec.exports.length} exports`);
console.log(`Found ${spec.types?.length || 0} types`);

// Save to file
import { writeFileSync } from 'fs';
writeFileSync('openpkg.json', JSON.stringify(spec, null, 2));
```

## API Reference

### `OpenPkg`

The main class for analyzing TypeScript files.

#### `analyzeFile(filePath: string): Promise<OpenPkgSpec>`

Analyzes a TypeScript file and generates an OpenPkg specification.

```typescript
const openpkg = new OpenPkg();
const spec = await openpkg.analyzeFile('./src/index.ts');
```

**Parameters:**
- `filePath` - Path to the TypeScript file to analyze

**Returns:**
- `Promise<OpenPkgSpec>` - The generated specification

**Throws:**
- Error if file doesn't exist
- Error if TypeScript parsing fails

### Type Definitions

#### `OpenPkgSpec`

The main specification interface:

```typescript
interface OpenPkgSpec {
  openpkg: string;        // Spec version (e.g., "1.0.0")
  meta: PackageMeta;      // Package metadata
  exports: Export[];      // All exports (functions, classes, etc.)
  types?: TypeDef[];      // Type definitions (interfaces, types, etc.)
}
```

#### `Export`

Represents an exported item:

```typescript
interface Export {
  id: string;                    // Unique identifier
  name: string;                  // Export name
  kind: ExportKind;              // 'function' | 'class' | 'variable' | 'interface' | 'type' | 'enum'
  description?: string;          // JSDoc description
  signatures?: Signature[];      // Function/method signatures
  properties?: Property[];       // Class/interface properties
  source?: SourceLocation;       // File location
}
```

#### `TypeDef`

Represents a type definition:

```typescript
interface TypeDef {
  id: string;                    // Unique identifier
  name: string;                  // Type name
  kind: 'interface' | 'type' | 'enum' | 'class';
  description?: string;          // JSDoc description
  schema?: Schema;               // Type schema (for interfaces)
  type?: string;                 // Type expression (for type aliases)
  properties?: Property[];       // Properties (for interfaces/classes)
  source?: SourceLocation;       // File location
}
```

## Examples

### Analyze a Package Entry Point

```typescript
import { OpenPkg } from 'openpkg-sdk';
import { resolve } from 'path';

async function analyzePackage() {
  const openpkg = new OpenPkg();
  
  // Analyze main entry point
  const spec = await openpkg.analyzeFile(
    resolve(process.cwd(), 'src/index.ts')
  );
  
  // List all exported functions
  const functions = spec.exports.filter(e => e.kind === 'function');
  console.log('Exported functions:');
  functions.forEach(fn => {
    console.log(`- ${fn.name}: ${fn.description || 'No description'}`);
  });
  
  // List all interfaces
  const interfaces = spec.types?.filter(t => t.kind === 'interface') || [];
  console.log('\nInterfaces:');
  interfaces.forEach(int => {
    console.log(`- ${int.name}: ${int.description || 'No description'}`);
  });
}
```

### Build Documentation from Spec

```typescript
import { OpenPkg } from 'openpkg-sdk';
import type { OpenPkgSpec, Export } from 'openpkg-sdk';

async function generateDocs(filePath: string): Promise<string> {
  const openpkg = new OpenPkg();
  const spec = await openpkg.analyzeFile(filePath);
  
  let markdown = `# ${spec.meta.name}\n\n`;
  markdown += `${spec.meta.description}\n\n`;
  
  // Document exports
  markdown += '## Exports\n\n';
  spec.exports.forEach(exp => {
    markdown += `### ${exp.name}\n\n`;
    markdown += `**Kind:** ${exp.kind}\n\n`;
    
    if (exp.description) {
      markdown += `${exp.description}\n\n`;
    }
    
    if (exp.signatures && exp.signatures.length > 0) {
      exp.signatures.forEach(sig => {
        markdown += '**Parameters:**\n';
        sig.parameters?.forEach(param => {
          markdown += `- \`${param.name}\`: ${param.description || 'No description'}\n`;
        });
        
        if (sig.returns) {
          markdown += `\n**Returns:** ${sig.returns.description || 'No description'}\n`;
        }
      });
    }
    
    markdown += '\n';
  });
  
  return markdown;
}
```

### Validate Package API

```typescript
import { OpenPkg } from 'openpkg-sdk';

async function validateAPI(filePath: string, requiredExports: string[]) {
  const openpkg = new OpenPkg();
  const spec = await openpkg.analyzeFile(filePath);
  
  const exportNames = spec.exports.map(e => e.name);
  const missing = requiredExports.filter(name => !exportNames.includes(name));
  
  if (missing.length > 0) {
    throw new Error(`Missing required exports: ${missing.join(', ')}`);
  }
  
  console.log('✓ All required exports found');
}

// Usage
validateAPI('./src/index.ts', ['createUser', 'updateUser', 'deleteUser']);
```

### Extract Type Information

```typescript
import { OpenPkg } from 'openpkg-sdk';

async function extractTypes(filePath: string) {
  const openpkg = new OpenPkg();
  const spec = await openpkg.analyzeFile(filePath);
  
  // Find a specific type
  const userType = spec.types?.find(t => t.name === 'User');
  
  if (userType && userType.kind === 'interface' && userType.schema) {
    console.log('User interface properties:');
    Object.entries(userType.schema.properties || {}).forEach(([key, prop]) => {
      console.log(`- ${key}: ${prop.type}`);
    });
  }
}
```

## Advanced Usage

### Custom Error Handling

```typescript
import { OpenPkg } from 'openpkg-sdk';

async function safeAnalyze(filePath: string) {
  const openpkg = new OpenPkg();
  
  try {
    const spec = await openpkg.analyzeFile(filePath);
    return { success: true, spec };
  } catch (error) {
    if (error.message.includes('File not found')) {
      return { success: false, error: 'File does not exist' };
    }
    if (error.message.includes('Syntax error')) {
      return { success: false, error: 'TypeScript syntax error' };
    }
    return { success: false, error: error.message };
  }
}
```

### Analyzing Multiple Files

```typescript
import { OpenPkg } from 'openpkg-sdk';
import { glob } from 'glob';

async function analyzeMultiple(pattern: string) {
  const openpkg = new OpenPkg();
  const files = await glob(pattern);
  
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const spec = await openpkg.analyzeFile(file);
        return { file, spec, error: null };
      } catch (error) {
        return { file, spec: null, error: error.message };
      }
    })
  );
  
  // Merge all specs
  const merged = {
    openpkg: '1.0.0',
    meta: { name: 'merged-package' },
    exports: results.flatMap(r => r.spec?.exports || []),
    types: results.flatMap(r => r.spec?.types || [])
  };
  
  return merged;
}

// Analyze all files in src
const spec = await analyzeMultiple('src/**/*.ts');
```

## Limitations

- Only analyzes TypeScript source files (`.ts`, `.tsx`)
- Requires TypeScript to be installed in your project
- Does not follow imports across files (use CLI with `--follow=imports` for this)
- Cannot analyze from URLs (use CLI `analyze` command for this)

## Development

To work on the SDK locally:

```bash
git clone https://github.com/ryanwaits/openpkg.git
cd openpkg/packages/sdk
bun install
bun test
```

## License

MIT