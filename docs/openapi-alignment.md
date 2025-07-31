# OpenAPI Alignment in OpenPkg

OpenPkg now follows OpenAPI 3.0 patterns for representing type information, making it familiar to developers who work with OpenAPI specifications.

## Key Changes from Previous Format

### 1. Schema Wrapper
All type information is now wrapped in a `schema` object, following OpenAPI conventions:

**Before:**
```json
{
  "name": "data",
  "type": "object",
  "properties": [...],
  "optional": false
}
```

**After:**
```json
{
  "name": "data",
  "required": true,
  "schema": {
    "type": "object",
    "properties": {...},
    "required": ["prop1", "prop2"]
  }
}
```

### 2. Properties as Objects
Properties are now represented as objects (key-value pairs) instead of arrays:

**Before:**
```json
"properties": [
  { "name": "id", "type": "number", "optional": false },
  { "name": "name", "type": "string", "optional": false }
]
```

**After:**
```json
"properties": {
  "id": { "type": "number" },
  "name": { "type": "string" }
},
"required": ["id", "name"]
```

### 3. Required Array
Instead of `optional` flags on each property, we now use a `required` array:

**Before:**
```json
{ "name": "email", "type": "string", "optional": true }
```

**After:**
```json
"properties": {
  "email": { "type": "string" }
}
// Note: "email" is not in the required array
```

### 4. Return Type Format
Return types now use a `returns` object with schema:

**Before:**
```json
"returnType": "Promise<User>"
```

**After:**
```json
"returns": {
  "schema": { "$ref": "#/types/User" },
  "description": "Returns the created user"
}
```

## Type Representations

### Primitive Types
```json
{ "type": "string" }
{ "type": "number" }
{ "type": "boolean" }
{ "type": "null" }     // for null, undefined, void
```

### BigInt
```json
{ "type": "string", "format": "bigint" }
```

### References
```json
{ "$ref": "#/types/TypeName" }
```

### Arrays
```json
{ "type": "array", "items": { "type": "string" } }
```

### Union Types (anyOf)
```json
{
  "anyOf": [
    { "type": "string" },
    { "type": "number" },
    { "$ref": "#/types/CustomType" }
  ]
}
```

### Object Unions (oneOf)
```json
{
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "publicKey": { "type": "string" }
      },
      "required": ["publicKey"]
    },
    {
      "type": "object",
      "properties": {
        "publicKeys": { "type": "array" }
      },
      "required": ["publicKeys"]
    }
  ]
}
```

### Literal Types (enums)
```json
{ "enum": ["mainnet", "testnet", "devnet"] }
```

## Complete Example

Here's a function with various parameter types in the new format:

```json
{
  "id": "createTransaction",
  "name": "createTransaction",
  "kind": "function",
  "signatures": [
    {
      "parameters": [
        {
          "name": "options",
          "required": true,
          "description": "Transaction options",
          "schema": {
            "type": "object",
            "properties": {
              "recipient": {
                "type": "string",
                "description": "Recipient address"
              },
              "amount": {
                "type": "number",
                "description": "Amount to send"
              },
              "fee": {
                "anyOf": [
                  { "type": "number" },
                  { "type": "string", "format": "bigint" }
                ],
                "description": "Transaction fee"
              },
              "memo": {
                "type": "string",
                "description": "Optional memo"
              }
            },
            "required": ["recipient", "amount"]
          }
        }
      ],
      "returns": {
        "schema": { "$ref": "#/types/Transaction" },
        "description": "The created transaction"
      }
    }
  ]
}
```

## Benefits

1. **Familiarity**: Developers who know OpenAPI will immediately understand the format
2. **Tooling**: Existing OpenAPI tools can potentially work with parts of the spec
3. **Consistency**: Same patterns for representing types across the industry
4. **Extensibility**: Easy to add OpenAPI features like `examples`, `deprecated`, etc.

## Migration Notes

If you're upgrading from a previous version of OpenPkg:

1. Update any code that reads the `properties` array - it's now an object
2. Check for `required` array instead of `optional` flags
3. Access return types via `returns.schema` instead of `returnType`
4. Parameters now have `required` boolean instead of `optional`