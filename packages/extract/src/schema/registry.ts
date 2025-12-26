import type ts from 'typescript';
import type { SpecSchema } from '@openpkg-ts/spec';

export type SchemaAdapter = {
  name: string;
  detect: (node: ts.Node, checker: ts.TypeChecker) => boolean;
  extract: (node: ts.Node, checker: ts.TypeChecker) => SpecSchema | null;
};

const adapters: SchemaAdapter[] = [];

export function registerAdapter(adapter: SchemaAdapter): void {
  adapters.push(adapter);
}

export function findAdapter(node: ts.Node, checker: ts.TypeChecker): SchemaAdapter | undefined {
  return adapters.find(a => a.detect(node, checker));
}

export function isSchemaType(node: ts.Node, checker: ts.TypeChecker): boolean {
  return adapters.some(a => a.detect(node, checker));
}

export function extractSchemaType(node: ts.Node, checker: ts.TypeChecker): SpecSchema | null {
  const adapter = findAdapter(node, checker);
  return adapter?.extract(node, checker) ?? null;
}
