# Schema Type Extraction Research

**Date**: 2024-12-23
**Goal**: Extract output types from schema validation libraries using TypeScript Compiler API

## Summary

All four schema libraries can be statically analyzed to extract their output types.
No runtime execution required.

---

## ArkType

**Detection Pattern**: Type name starts with `Type<`

**Type Structure**:
```
Type<Output, Input>
```

**Extraction Strategy**: Direct access to type argument at index 0

**Example**:
```typescript
// Input
const UserSchema = type({ name: 'string', age: 'number' });

// TypeScript sees
Type<{ name: string; age: number; }, {}>

// We extract
arg[0] = { name: string; age: number; }
```

**Code**:
```typescript
function extractArkTypeOutput(type: ts.Type, checker: ts.TypeChecker): ts.Type | null {
  const typeName = checker.typeToString(type);
  if (!typeName.startsWith('Type<')) return null;

  const typeRef = type as ts.TypeReference;
  const args = checker.getTypeArguments(typeRef);
  return args[0] ?? null;
}
```

---

## Zod

**Detection Pattern**: Type name matches `/^Zod[A-Z]/`

**Type Structure**:
```
ZodObject<Shape, Config>    where Shape = { name: ZodString, ... }
ZodArray<Element>           where Element = ZodString, etc.
ZodString, ZodNumber, etc.
```

**Extraction Strategy**: Access `_output` property on schema type

**Example**:
```typescript
// Input
const UserSchema = z.object({ name: z.string(), age: z.number() });

// TypeScript sees
ZodObject<{ name: ZodString; age: ZodNumber; }, $strip>

// Schema has _output property
_output: { name: string; age: number; }
```

**Code**:
```typescript
function extractZodOutput(type: ts.Type, checker: ts.TypeChecker): ts.Type | null {
  const typeName = checker.typeToString(type);
  if (!/^Zod[A-Z]/.test(typeName)) return null;

  const outputSymbol = type.getProperty('_output');
  if (!outputSymbol) return null;

  return checker.getTypeOfSymbol(outputSymbol);
}
```

---

## TypeBox

**Detection Pattern**: Type name matches `/^T[A-Z]/` (TObject, TArray, TString, etc.)

**Type Structure**:
```
TObject<Properties>    where Properties = { name: TString, ... }
TArray<Element>        where Element = TString, etc.
TString, TNumber, etc.
```

**Extraction Strategy**: Access `static` property on schema type

**Example**:
```typescript
// Input
const UserSchema = Type.Object({ name: Type.String(), age: Type.Number() });

// TypeScript sees
TObject<{ name: TString; age: TNumber; }>

// Schema has static property
static: { name: string; age: number; }
```

**Code**:
```typescript
function extractTypeBoxOutput(type: ts.Type, checker: ts.TypeChecker): ts.Type | null {
  const typeName = checker.typeToString(type);
  if (!/^T[A-Z]/.test(typeName)) return null;

  const staticSymbol = type.getProperty('static');
  if (!staticSymbol) return null;

  return checker.getTypeOfSymbol(staticSymbol);
}
```

---

## Valibot

**Detection Pattern**: Type name matches `/Schema(<|$)/` (ObjectSchema, ArraySchema, etc.)

**Type Structure**:
```
ObjectSchema<Entries, Message>
ArraySchema<Item, Message>
StringSchema<Message>, etc.
```

**Extraction Strategy**: Access `~types.output` property (remove `undefined` from union first)

**Example**:
```typescript
// Input
const UserSchema = v.object({ name: v.string(), age: v.number() });

// TypeScript sees
ObjectSchema<{ readonly name: StringSchema<undefined>; ... }, undefined>

// Schema has ~types property (union with undefined)
~types: { input: {...}; output: {...}; issue: ... } | undefined

// After removing undefined, access output
output: { name: string; age: number; }
```

**Code**:
```typescript
function extractValibotOutput(type: ts.Type, checker: ts.TypeChecker): ts.Type | null {
  const typeName = checker.typeToString(type);
  if (!/Schema(<|$)/.test(typeName) || typeName.includes('Zod')) return null;

  const typesSymbol = type.getProperty('~types');
  if (!typesSymbol) return null;

  let typesType = checker.getTypeOfSymbol(typesSymbol);

  // Remove undefined from union
  if (typesType.isUnion()) {
    const nonNullable = typesType.types.filter(t =>
      !(t.flags & ts.TypeFlags.Undefined)
    );
    if (nonNullable.length === 1) {
      typesType = nonNullable[0];
    }
  }

  const outputSymbol = typesType.getProperty('output');
  if (!outputSymbol) return null;

  return checker.getTypeOfSymbol(outputSymbol);
}
```

---

## Edge Cases Tested

| Scenario | Zod | Valibot | TypeBox | ArkType |
|----------|-----|---------|---------|---------|
| Object | ✅ | ✅ | ✅ | ✅ |
| Array | ✅ | ✅ | ✅ | ✅ |
| Optional fields | ✅ | ✅ | ✅ | ✅ |
| Nested objects | ✅ | ✅ | ✅ | ✅ |
| Union | ✅ | ✅ | ✅ | ✅ |
| Literal union (enum) | ✅ | ✅ | ✅ | ✅ |

---

## Implementation Notes

1. **No runtime required** - All extraction uses TypeScript Compiler API
2. **Graceful fallback** - If extraction fails, return `null` and use raw type string
3. **Property access** - Use `type.getProperty()` for type-level properties
4. **Union handling** - Some libraries use `T | undefined`, need to filter

---

## Files

- Fixtures: `packages/sdk/src/__fixtures__/schema-libs/`
- Spike scripts: `packages/sdk/scripts/spike-schema-extraction*.ts`
