import * as fs from 'node:fs';
import * as path from 'node:path';
import { ts } from '../ts-module';
import type { AnalysisContext } from './context';
import { serializeClass } from './serializers/classes';
import { serializeEnum } from './serializers/enums';
import { type SerializerContext, serializeFunctionExport } from './serializers/functions';
import { serializeInterface } from './serializers/interfaces';
import { serializeTypeAlias } from './serializers/type-aliases';
import { serializeVariable } from './serializers/variables';
import type { OpenPkgSpec, TypeDefinition } from './spec-types';
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
    $schema:
      'https://raw.githubusercontent.com/ryanwaits/openpkg/main/schemas/v0.1.0/openpkg.schema.json',
    openpkg: '0.1.0',
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
      spec.exports.push(withExportName(exportEntry, exportName));
    } else if (ts.isClassDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeClass(
        declaration,
        targetSymbol,
        serializerContext,
      );
      spec.exports.push(withExportName(exportEntry, exportName));
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isInterfaceDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeInterface(
        declaration,
        targetSymbol,
        serializerContext,
      );
      spec.exports.push(withExportName(exportEntry, exportName));
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeTypeAlias(
        declaration,
        targetSymbol,
        serializerContext,
      );
      spec.exports.push(withExportName(exportEntry, exportName));
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isEnumDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeEnum(
        declaration,
        targetSymbol,
        serializerContext,
      );
      spec.exports.push(withExportName(exportEntry, exportName));
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isVariableDeclaration(declaration)) {
      const exportEntry = serializeVariable(declaration, targetSymbol, serializerContext);
      spec.exports.push(withExportName(exportEntry, exportName));
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
          if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
            spec.types?.push(typeDefinition);
          }
        } else if (ts.isInterfaceDeclaration(declaration)) {
          const { typeDefinition } = serializeInterface(
            declaration,
            targetSymbol,
            serializerContext,
          );
          if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
            spec.types?.push(typeDefinition);
          }
        } else if (ts.isTypeAliasDeclaration(declaration)) {
          const { typeDefinition } = serializeTypeAlias(
            declaration,
            targetSymbol,
            serializerContext,
          );
          if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
            spec.types?.push(typeDefinition);
          }
        } else if (ts.isEnumDeclaration(declaration)) {
          const { typeDefinition } = serializeEnum(declaration, targetSymbol, serializerContext);
          if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
            spec.types?.push(typeDefinition);
          }
        }
      }
    }
  }

  return spec;
}

/**
 * Follows export aliases back to the declaration that carries the type
 * information we need to serialize.
 */
function resolveExportTarget(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): {
  declaration?: ts.Declaration;
  targetSymbol: ts.Symbol;
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
