import { describe, expect, it } from 'bun:test';
import * as ts from 'typescript';
import { formatTypeReference, structureParameter } from '../src/utils/parameter-utils';
import { createTestCompiler, getDeclaration } from './test-helpers';

describe('formatTypeReference', () => {
  it('returns primitive schema for basic types', () => {
    const { checker, sourceFile } = createTestCompiler(`const value: string = 'hello';`);
    const variableStatement = getDeclaration(sourceFile, ts.isVariableStatement);
    const declaration = variableStatement.declarationList.declarations[0];
    const type = checker.getTypeAtLocation(declaration.name);

    const result = formatTypeReference(type, checker, new Map());

    expect(result).toEqual({ type: 'string' });
  });

  it('returns $ref for known referenced types', () => {
    const { checker, sourceFile } = createTestCompiler(`
      interface User { id: string }
      const current: User = { id: '1' };
    `);
    const variableStatement = getDeclaration(sourceFile, (node): node is ts.VariableStatement =>
      ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText() === 'current',
    );
    const declaration = variableStatement.declarationList.declarations[0];
    const typeNode = declaration.type as ts.TypeNode;
    const type = checker.getTypeFromTypeNode(typeNode);

    const typeRefs = new Map<string, string>([['User', 'User']]);
    const result = formatTypeReference(type, checker, typeRefs);

    expect(result).toEqual({ $ref: '#/types/User' });
  });

  it('serializes union types as anyOf arrays', () => {
    const { checker, sourceFile } = createTestCompiler(`
      interface User { id: string }
      type MaybeUser = User | null;
    `);
    const maybeUser = getDeclaration(
      sourceFile,
      (node): node is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(node) && node.name.text === 'MaybeUser',
    );
    const type = checker.getTypeFromTypeNode(maybeUser.type);

    const typeRefs = new Map<string, string>([['User', 'User']]);
    const result = formatTypeReference(type, checker, typeRefs);

    expect(result).toEqual({
      anyOf: [{ type: 'null' }, { $ref: '#/types/User' }],
    });
  });

  it('extracts literal values as enums', () => {
    const { checker, sourceFile } = createTestCompiler(`const status = 'ready' as const;`);
    const variableStatement = getDeclaration(sourceFile, ts.isVariableStatement);
    const declaration = variableStatement.declarationList.declarations[0];
    const type = checker.getTypeAtLocation(declaration.name);

    const result = formatTypeReference(type, checker, new Map());

    expect(result).toEqual({ enum: ['ready'] });
  });

  it('returns $ref when expanding self-referential aliases', () => {
    const { checker, sourceFile } = createTestCompiler(`
      type Recursive = {
        value: string;
        next?: Recursive;
      };
    `);

    const recursiveAlias = getDeclaration(
      sourceFile,
      (node): node is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(node) && node.name.text === 'Recursive',
    );

    const recursiveType = checker.getTypeFromTypeNode(recursiveAlias.type);

    const schema = formatTypeReference(recursiveType, checker, new Map());

    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        value: { type: 'string' },
      },
      required: ['value'],
    });

    if (typeof schema === 'object' && schema !== null && 'properties' in schema) {
      const properties = (schema as { properties: Record<string, unknown> }).properties;

      expect(properties).toHaveProperty('next');
      expect(properties.next).toEqual({
        anyOf: [{ type: 'null' }, { $ref: '#/types/Recursive' }],
      });
    }
  });
});


describe('structureParameter', () => {
  it('uses object for destructured parameters derived from type aliases', () => {
    const { checker, sourceFile } = createTestCompiler(`\n      type ApiKeyMiddlewareOpts = { apiKey: string };\n      function middleware({ apiKey }: ApiKeyMiddlewareOpts) {}\n    `);
    const fn = getDeclaration(
      sourceFile,
      (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'middleware',
    );
    const signature = checker.getSignatureFromDeclaration(fn)!;
    const paramSymbol = signature.getParameters()[0];
    const paramDecl = fn.parameters[0];
    const paramType = checker.getTypeAtLocation(paramDecl);

    const structured = structureParameter(
      paramSymbol,
      paramDecl,
      paramType,
      checker,
      new Map(),
      null,
      undefined,
      new Set(),
    );

    expect(structured.name).toBe('options');
  });
});
