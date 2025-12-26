import type { SpecSchema } from '@openpkg-ts/spec';
import type ts from 'typescript';

export function buildSchema(type: ts.Type, checker: ts.TypeChecker, depth = 0): SpecSchema {
  if (depth > 10) {
    return { type: checker.typeToString(type) };
  }

  const typeString = checker.typeToString(type);

  // Primitives
  if (type.flags & 4 /* String */) return { type: 'string' };
  if (type.flags & 8 /* Number */) return { type: 'number' };
  if (type.flags & 16 /* Boolean */) return { type: 'boolean' };
  if (type.flags & 32768 /* Undefined */) return { type: 'undefined' };
  if (type.flags & 65536 /* Null */) return { type: 'null' };
  if (type.flags & 16384 /* Void */) return { type: 'void' };
  if (type.flags & 1 /* Any */) return { type: 'any' };
  if (type.flags & 2 /* Unknown */) return { type: 'unknown' };
  if (type.flags & 131072 /* Never */) return { type: 'never' };

  // Fallback to type string
  return { type: typeString };
}
