import type ts from 'typescript';

export function isExported(node: ts.Node): boolean {
  const modifiers = (node as ts.HasModifiers).modifiers;
  if (!modifiers) return false;
  return modifiers.some(m =>
    m.kind === 95 /* ExportKeyword */
  );
}

export function getNodeName(node: ts.Node): string | undefined {
  if ('name' in node && node.name) {
    const name = node.name as ts.Identifier;
    return name.text;
  }
  return undefined;
}
