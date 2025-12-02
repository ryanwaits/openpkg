# Schema Library Plugin System

## Status: Future Enhancement

Created: 2025-01-01
Priority: Medium
Related: TypeBox, Zod, io-ts, Yup, Valibot

---

## Problem Statement

Popular TypeScript schema validation libraries use runtime schema definitions with inferred types. The current doccov analyzer handles the TypeScript types correctly (via `Static<typeof Schema>`, `z.infer<typeof schema>`, etc.), but the **schema constants themselves** appear as opaque references.

### Current Behavior

```typescript
// TypeBox
export const UserSchema = Type.Object({
  name: Type.String({ description: 'User name' }),
  age: Type.Number({ minimum: 0 }),
});
export type User = Static<typeof UserSchema>;
```

**Generated spec:**
```json
{
  "id": "UserSchema",
  "kind": "variable",
  "type": { "$ref": "#/types/TObject" }  // Opaque!
},
{
  "id": "User",
  "kind": "type",
  "type": { "type": "object", "tsType": "{ name: string; age: number; }" }  // Resolved correctly
}
```

### Desired Behavior

```json
{
  "id": "UserSchema",
  "kind": "variable",
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "User name" },
      "age": { "type": "number", "minimum": 0 }
    },
    "required": ["name", "age"]
  }
}
```

---

## Affected Libraries

| Library | Pattern | Type Inference |
|---------|---------|----------------|
| TypeBox | `Type.Object({...})` | `Static<typeof Schema>` |
| Zod | `z.object({...})` | `z.infer<typeof schema>` |
| io-ts | `t.type({...})` | `TypeOf<typeof codec>` |
| Yup | `yup.object({...})` | `InferType<typeof schema>` |
| Valibot | `v.object({...})` | `InferOutput<typeof Schema>` |

---

## Known Limitations to Address

### TypeBox Specific

1. **TObject references** — Schema variables show as `$ref: "#/types/TObject"` instead of expanded structure
2. **Embedded descriptions** — `Type.String({ description: '...' })` not captured as JSDoc
3. **Validation constraints** — `Type.Number({ minimum: 0, maximum: 100 })` constraints lost
4. **Custom formats** — `Type.String({ format: 'email' })` not preserved

### Zod Specific

1. **ZodObject references** — Similar to TypeBox, `z.object()` appears as opaque type
2. **Refinements** — `.refine()` and `.transform()` lost
3. **Descriptions** — `.describe('...')` not captured
4. **Default values** — `.default()` not captured

---

## Proposed Plugin Architecture

### Plugin Interface

```typescript
// packages/sdk/src/plugins/types.ts

export interface DoccovPlugin {
  /** Unique plugin identifier */
  name: string;
  
  /** Detect if this plugin applies to the package */
  detect(packageJson: PackageJson): boolean;
  
  /**
   * Hook: Resolve property types when valueDeclaration is missing
   * Called during parameter/property type resolution
   */
  resolvePropertyType?(
    prop: ts.Symbol,
    parentType: ts.Type,
    typeChecker: ts.TypeChecker,
  ): ts.Type | undefined;
  
  /**
   * Hook: Custom variable serialization
   * Called when serializing const/let declarations
   */
  serializeVariable?(
    symbol: ts.Symbol,
    declaration: ts.VariableDeclaration,
    context: SerializerContext,
  ): ExportDefinition | undefined;
  
  /**
   * Hook: Extract descriptions from non-JSDoc sources
   * Called to supplement JSDoc-based descriptions
   */
  extractDescription?(
    declaration: ts.Declaration,
    context: SerializerContext,
  ): string | undefined;
  
  /**
   * Hook: Extract schema constraints
   * Called to capture validation rules (min, max, pattern, etc.)
   */
  extractConstraints?(
    declaration: ts.Declaration,
    context: SerializerContext,
  ): Record<string, unknown> | undefined;
}
```

### Plugin Registration

```typescript
// packages/sdk/src/plugins/registry.ts

export class PluginRegistry {
  private plugins: DoccovPlugin[] = [];
  
  register(plugin: DoccovPlugin): void {
    this.plugins.push(plugin);
  }
  
  detect(packageJson: PackageJson): DoccovPlugin[] {
    return this.plugins.filter(p => p.detect(packageJson));
  }
}

// Built-in plugins
export const builtInPlugins = [
  typeboxPlugin,
  zodPlugin,
];
```

---

## TypeBox Plugin Implementation

```typescript
// packages/sdk/src/plugins/typebox.ts

import type { DoccovPlugin } from './types';

export const typeboxPlugin: DoccovPlugin = {
  name: 'typebox',
  
  detect(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return '@sinclair/typebox' in deps;
  },
  
  serializeVariable(symbol, declaration, context) {
    const { checker } = context;
    
    // Check if this is a TypeBox schema (Type.Object, Type.String, etc.)
    const initializer = declaration.initializer;
    if (!initializer || !ts.isCallExpression(initializer)) {
      return undefined;
    }
    
    const callText = initializer.expression.getText();
    if (!callText.startsWith('Type.')) {
      return undefined;
    }
    
    // Parse the TypeBox schema call
    const schemaType = callText.replace('Type.', '');
    const schema = parseTypeBoxCall(schemaType, initializer, checker);
    
    if (!schema) {
      return undefined; // Let default handling take over
    }
    
    return {
      id: symbol.getName(),
      name: symbol.getName(),
      kind: 'variable',
      schema,
      description: extractTypeBoxDescription(initializer),
      // ... other fields
    };
  },
  
  extractDescription(declaration, context) {
    // Look for { description: '...' } in TypeBox options
    if (!ts.isVariableDeclaration(declaration)) {
      return undefined;
    }
    
    const init = declaration.initializer;
    if (!init || !ts.isCallExpression(init)) {
      return undefined;
    }
    
    // Find options argument with description
    for (const arg of init.arguments) {
      if (ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (ts.isPropertyAssignment(prop) && 
              prop.name.getText() === 'description' &&
              ts.isStringLiteral(prop.initializer)) {
            return prop.initializer.text;
          }
        }
      }
    }
    
    return undefined;
  },
};

function parseTypeBoxCall(
  schemaType: string,
  call: ts.CallExpression,
  checker: ts.TypeChecker,
): Record<string, unknown> | undefined {
  switch (schemaType) {
    case 'Object':
      return parseTypeBoxObject(call, checker);
    case 'String':
      return { type: 'string', ...extractConstraints(call) };
    case 'Number':
      return { type: 'number', ...extractConstraints(call) };
    case 'Boolean':
      return { type: 'boolean' };
    case 'Array':
      return { type: 'array', items: parseTypeBoxCall(/* nested */) };
    case 'Union':
      return { anyOf: parseUnionMembers(call, checker) };
    case 'Literal':
      return { enum: [extractLiteralValue(call)] };
    // ... more cases
    default:
      return undefined;
  }
}
```

---

## Zod Plugin Implementation

```typescript
// packages/sdk/src/plugins/zod.ts

import type { DoccovPlugin } from './types';

export const zodPlugin: DoccovPlugin = {
  name: 'zod',
  
  detect(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return 'zod' in deps;
  },
  
  serializeVariable(symbol, declaration, context) {
    const { checker } = context;
    
    const initializer = declaration.initializer;
    if (!initializer) return undefined;
    
    // Check for z.object(), z.string(), etc.
    const callChain = parseZodCallChain(initializer);
    if (!callChain) return undefined;
    
    const schema = buildSchemaFromZodChain(callChain, checker);
    const description = extractZodDescription(callChain);
    
    return {
      id: symbol.getName(),
      name: symbol.getName(),
      kind: 'variable',
      schema,
      description,
    };
  },
  
  extractDescription(declaration, context) {
    // Look for .describe('...') in Zod chain
    const init = (declaration as ts.VariableDeclaration).initializer;
    if (!init) return undefined;
    
    const chain = parseZodCallChain(init);
    return chain?.find(c => c.method === 'describe')?.args[0] as string;
  },
};

interface ZodCallChainItem {
  method: string;
  args: unknown[];
}

function parseZodCallChain(node: ts.Expression): ZodCallChainItem[] | undefined {
  const chain: ZodCallChainItem[] = [];
  
  let current = node;
  while (ts.isCallExpression(current)) {
    if (ts.isPropertyAccessExpression(current.expression)) {
      chain.unshift({
        method: current.expression.name.getText(),
        args: current.arguments.map(extractArgValue),
      });
      current = current.expression.expression;
    } else {
      break;
    }
  }
  
  // Check if it starts with 'z.'
  if (ts.isPropertyAccessExpression(current) && 
      current.expression.getText() === 'z') {
    chain.unshift({
      method: current.name.getText(),
      args: [],
    });
    return chain;
  }
  
  return undefined;
}
```

---

## Implementation Plan

### Phase 1: Plugin Infrastructure
1. Define plugin interface types
2. Create plugin registry
3. Add plugin hooks to serialization pipeline
4. Add plugin configuration to doccov.config.ts

### Phase 2: TypeBox Plugin
1. Implement schema detection
2. Parse Type.Object() structures
3. Extract descriptions and constraints
4. Handle nested schemas and unions

### Phase 3: Zod Plugin
1. Implement schema detection
2. Parse z.object() call chains
3. Handle refinements and transforms
4. Extract descriptions and defaults

### Phase 4: Testing & Documentation
1. Create test fixtures for each library
2. Add plugin documentation
3. Publish as optional dependencies

---

## Configuration

```typescript
// doccov.config.ts
import { defineConfig } from '@doccov/cli/config';
import { typeboxPlugin } from '@doccov/plugin-typebox';
import { zodPlugin } from '@doccov/plugin-zod';

export default defineConfig({
  plugins: [
    typeboxPlugin(),
    zodPlugin({
      captureRefinements: true,
      captureTransforms: false,
    }),
  ],
});
```

---

## References

- TypeBox: https://github.com/sinclairzx81/typebox
- Zod: https://github.com/colinhacks/zod
- io-ts: https://github.com/gcanti/io-ts
- OpenAPI JSON Schema: https://spec.openapis.org/oas/v3.1.0#schema-object

