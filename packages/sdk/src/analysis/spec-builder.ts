import * as fs from 'node:fs';
import * as path from 'node:path';
import { SCHEMA_URL } from '@openpkg-ts/spec';
import type * as TS from 'typescript';
import { ts } from '../ts-module';

import type { AnalysisContext } from './context';
import { computeDocsCoverage } from './docs-coverage';
import { serializeClass } from './serializers/classes';
import { serializeEnum } from './serializers/enums';
import { type SerializerContext, serializeFunctionExport } from './serializers/functions';
import { serializeInterface } from './serializers/interfaces';
import { serializeNamespace } from './serializers/namespaces';
import { serializeTypeAlias } from './serializers/type-aliases';
import { serializeVariable } from './serializers/variables';
import type { OpenPkgSpec } from './spec-types';
import { TypeRegistry } from './type-registry';

export function buildOpenPkgSpec(
  context: AnalysisContext,
  resolveExternalTypes: boolean,
): OpenPkgSpec {
  const { baseDir, checker: typeChecker, sourceFile, program } = context;

  const packageJsonPath = path.join(baseDir, 'package.json');
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    : {};

  const spec: OpenPkgSpec = {
    $schema: SCHEMA_URL,
    openpkg: '0.2.0',
    meta: {
      name: packageJson.name || 'unknown',
      version: packageJson.version || '1.0.0',
      description: packageJson.description || '',
      license: packageJson.license || '',
      repository: packageJson.repository?.url || packageJson.repository || '',
      ecosystem: 'js/ts',
    },
    exports: [],
    types: [],
  };

  const typeRegistry = new TypeRegistry();
  const serializerContext: SerializerContext = {
    checker: typeChecker,
    typeRegistry,
  };

  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return spec;
  }

  const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

  for (const symbol of exportedSymbols) {
    const { declaration, targetSymbol } = resolveExportTarget(symbol, typeChecker);
    if (!declaration) continue;

    const exportName = symbol.getName();

    if (
      ts.isClassDeclaration(declaration) ||
      ts.isInterfaceDeclaration(declaration) ||
      ts.isTypeAliasDeclaration(declaration) ||
      ts.isEnumDeclaration(declaration)
    ) {
      typeRegistry.registerExportedType(exportName, targetSymbol.getName());
    }
  }

  for (const symbol of exportedSymbols) {
    const { declaration, targetSymbol } = resolveExportTarget(symbol, typeChecker);
    if (!declaration) continue;

    const exportName = symbol.getName();

    if (ts.isFunctionDeclaration(declaration)) {
      const exportEntry = serializeFunctionExport(declaration, targetSymbol, serializerContext);
      addExport(spec, exportEntry, exportName, baseDir);
    } else if (ts.isClassDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeClass(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
    } else if (ts.isInterfaceDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeInterface(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeTypeAlias(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
    } else if (ts.isEnumDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeEnum(
        declaration,
        targetSymbol,
        serializerContext,
      );
      addExport(spec, exportEntry, exportName, baseDir);
      addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
    } else if (ts.isVariableDeclaration(declaration)) {
      const exportEntry = serializeVariable(declaration, targetSymbol, serializerContext);
      addExport(spec, exportEntry, exportName, baseDir);
    } else if (ts.isModuleDeclaration(declaration)) {
      const exportEntry = serializeNamespace(declaration, targetSymbol, serializerContext);
      addExport(spec, exportEntry, exportName, baseDir);
    }
  }

  for (const typeName of typeRegistry.getReferencedTypes()) {
    if (typeRegistry.isKnownType(typeName)) {
      continue;
    }

    const allSourceFiles = program.getSourceFiles();

    for (const file of allSourceFiles) {
      if (
        !resolveExternalTypes &&
        (file.fileName.includes('node_modules') ||
          (file.fileName.endsWith('.d.ts') && !file.fileName.startsWith(baseDir)))
      ) {
        continue;
      }

      const fileSymbol = typeChecker.getSymbolAtLocation(file);
      if (!fileSymbol) {
        continue;
      }

      const exports = typeChecker.getExportsOfModule(fileSymbol);

      for (const exportSymbol of exports) {
        if (exportSymbol.getName() !== typeName || typeRegistry.isKnownType(typeName)) {
          continue;
        }

        const { declaration, targetSymbol } = resolveExportTarget(exportSymbol, typeChecker);
        if (!declaration) continue;

        if (ts.isClassDeclaration(declaration)) {
          const { typeDefinition } = serializeClass(declaration, targetSymbol, serializerContext);
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        } else if (ts.isInterfaceDeclaration(declaration)) {
          const { typeDefinition } = serializeInterface(
            declaration,
            targetSymbol,
            serializerContext,
          );
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        } else if (ts.isTypeAliasDeclaration(declaration)) {
          const { typeDefinition } = serializeTypeAlias(
            declaration,
            targetSymbol,
            serializerContext,
          );
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        } else if (ts.isEnumDeclaration(declaration)) {
          const { typeDefinition } = serializeEnum(declaration, targetSymbol, serializerContext);
          addTypeDefinition(spec, typeRegistry, typeDefinition, baseDir);
        }
      }
    }
  }

  // Emit stub definitions for unresolved external types
  for (const typeName of typeRegistry.getReferencedTypes()) {
    if (typeRegistry.isKnownType(typeName)) {
      continue;
    }

    // This type couldn't be resolved - create a stub external type definition
    const stubDefinition = {
      id: typeName,
      name: typeName,
      kind: 'external' as const,
      description: `External type (not resolved)`,
    };

    if (typeRegistry.registerTypeDefinition(stubDefinition)) {
      spec.types?.push(stubDefinition);
    }
  }

  const coverage = computeDocsCoverage(spec);
  spec.docs = coverage.spec;
  spec.exports.forEach((entry) => {
    const exportCoverage = coverage.exports.get(entry.id);
    if (exportCoverage) {
      entry.docs = exportCoverage;
    }
  });

  return spec;
}

function addExport(
  spec: OpenPkgSpec,
  entry: OpenPkgSpec['exports'][number],
  exportName: string,
  baseDir: string,
): void {
  const named = withExportName(entry, exportName);
  spec.exports.push(applyPresentationDefaults(named, baseDir));
}

function addTypeDefinition(
  spec: OpenPkgSpec,
  typeRegistry: TypeRegistry,
  definition: NonNullable<OpenPkgSpec['types']>[number] | undefined,
  baseDir: string,
): void {
  if (!definition) {
    return;
  }

  const enriched = applyPresentationDefaults(definition, baseDir);
  if (typeRegistry.registerTypeDefinition(enriched)) {
    spec.types?.push(enriched);
  }
}

function applyPresentationDefaults<
  T extends {
    name: string;
    kind?: string;
    slug?: string;
    displayName?: string;
    category?: string;
    importPath?: string;
    source?: { file?: string };
  },
>(entry: T, baseDir: string): T {
  const slug = entry.slug ?? createSlug(entry.name);
  const displayName = entry.displayName ?? entry.name;
  const category = entry.category ?? entry.kind;
  const importPath = entry.importPath ?? deriveImportPath(entry.source?.file, baseDir);

  return {
    ...entry,
    ...(slug ? { slug } : {}),
    ...(displayName ? { displayName } : {}),
    ...(category ? { category } : {}),
    ...(importPath ? { importPath } : {}),
  };
}

function createSlug(name: string): string {
  const normalized = name
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .toLowerCase();
  return normalized || name.toLowerCase();
}

function deriveImportPath(sourceFile: string | undefined, baseDir: string): string | undefined {
  if (!sourceFile) {
    return undefined;
  }

  const relative = path.relative(baseDir, sourceFile);
  if (!relative || relative.startsWith('..')) {
    return undefined;
  }

  const normalized = relative.replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.[^.]+$/, '');
  if (!withoutExt) {
    return undefined;
  }

  const prefixed = withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
  return prefixed.replace(/\/\/+/, '/');
}

/**
 * Follows export aliases back to the declaration that carries the type
 * information we need to serialize.
 */
function resolveExportTarget(
  symbol: TS.Symbol,
  checker: TS.TypeChecker,
): {
  declaration?: TS.Declaration;
  targetSymbol: TS.Symbol;
} {
  let targetSymbol = symbol;

  if (symbol.flags & ts.SymbolFlags.Alias) {
    const aliasTarget = checker.getImmediateAliasedSymbol(symbol);
    if (aliasTarget) {
      targetSymbol = aliasTarget;
    }
  }

  const declarations = targetSymbol.declarations ?? [];
  const declaration =
    targetSymbol.valueDeclaration ||
    declarations.find((decl) => decl.kind !== ts.SyntaxKind.ExportSpecifier) ||
    declarations[0];

  return {
    declaration,
    targetSymbol,
  };
}

/**
 * When a symbol is re-exported under a different name, rewrite the serialized
 * entry so it reflects the public export name without losing the captured
 * metadata.
 */
function withExportName<T extends { id: string; name: string }>(entry: T, exportName: string): T {
  if (entry.name === exportName) {
    return entry;
  }

  return {
    ...entry,
    id: exportName,
    name: exportName,
  };
}
