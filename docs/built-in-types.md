# Built-in Types in OpenPkg

OpenPkg distinguishes between built-in JavaScript/TypeScript types and custom types to ensure proper type representation in the generated specification.

## Built-in Types (No $ref)

The following types are treated as primitives or built-in types and will NOT use `$ref` format:

### Primitive Types
- `string`
- `number`
- `boolean`
- `bigint`
- `symbol`
- `undefined`
- `null`

### Special TypeScript Types
- `any`
- `unknown`
- `never`
- `void`
- `object`

### Built-in Objects/Constructors
- `Array`
- `Promise`
- `Map`, `Set`, `WeakMap`, `WeakSet`
- `Date`
- `RegExp`
- `Error`
- `Function`
- `Object`, `String`, `Number`, `Boolean`, `BigInt`, `Symbol`

### Typed Arrays
- `Uint8Array`, `Int8Array`
- `Uint16Array`, `Int16Array`
- `Uint32Array`, `Int32Array`
- `Float32Array`, `Float64Array`
- `BigInt64Array`, `BigUint64Array`
- `Uint8ClampedArray`

### Array Buffer Related
- `ArrayBuffer`
- `ArrayBufferLike`
- `DataView`

### Global Objects
- `JSON`
- `Math`
- `Reflect`
- `Proxy`
- `Intl`
- `globalThis`

## Example Output

When these types appear in your code:

```typescript
export function processData(
  id: bigint,
  data: Uint8Array,
  options?: Map<string, any>
): Promise<void> { }
```

They will be represented as simple strings in the output:

```json
{
  "parameters": [
    {
      "name": "id",
      "type": "bigint"  // ✅ No $ref
    },
    {
      "name": "data",
      "type": "Uint8Array"  // ✅ No $ref
    },
    {
      "name": "options",
      "type": "Map<string, any>",  // ✅ No $ref
      "optional": true
    }
  ],
  "returnType": "Promise<void>"  // ✅ No $ref
}
```

## Custom Types (Use $ref)

Any type not in the above list will use `$ref` format:

```typescript
export function createUser(data: UserData): User { }
```

Output:
```json
{
  "parameters": [{
    "name": "data",
    "type": { "$ref": "#/types/UserData" }  // ✅ Custom type uses $ref
  }],
  "returnType": { "$ref": "#/types/User" }  // ✅ Custom type uses $ref
}
```

## Implementation Details

The built-in type checking is centralized in `src/utils/type-utils.ts` in the `isBuiltInType()` function. This ensures consistency across the entire codebase.