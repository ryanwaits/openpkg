import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import type { AnalysisContext } from './context';
import { TypeRegistry } from './type-registry';
import type { OpenPkgSpec, TypeDefinition } from './spec-types';
import { serializeFunctionExport, type SerializerContext } from './serializers/functions';
import { serializeClass } from './serializers/classes';
import { serializeInterface } from './serializers/interfaces';
import { serializeTypeAlias } from './serializers/type-aliases';
import { serializeEnum } from './serializers/enums';
import { serializeVariable } from './serializers/variables';

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
    const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
    if (!declaration) continue;

    const name = symbol.getName();

    if (
      ts.isClassDeclaration(declaration) ||
      ts.isInterfaceDeclaration(declaration) ||
      ts.isTypeAliasDeclaration(declaration) ||
      ts.isEnumDeclaration(declaration)
    ) {
      typeRegistry.registerExportedType(name);
    }
  }

  for (const symbol of exportedSymbols) {
    const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
    if (!declaration) continue;

    const name = symbol.getName();

    if (ts.isFunctionDeclaration(declaration)) {
      spec.exports.push(serializeFunctionExport(declaration, symbol, serializerContext));
    } else if (ts.isClassDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeClass(
        declaration,
        symbol,
        serializerContext,
      );
      spec.exports.push(exportEntry);
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isInterfaceDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeInterface(
        declaration,
        symbol,
        serializerContext,
      );
      spec.exports.push(exportEntry);
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeTypeAlias(
        declaration,
        symbol,
        serializerContext,
      );
      spec.exports.push(exportEntry);
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isEnumDeclaration(declaration)) {
      const { exportEntry, typeDefinition } = serializeEnum(
        declaration,
        symbol,
        serializerContext,
      );
      spec.exports.push(exportEntry);
      if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
        spec.types?.push(typeDefinition);
      }
    } else if (ts.isVariableDeclaration(declaration)) {
      spec.exports.push(serializeVariable(declaration, symbol, serializerContext));
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

        const declaration = exportSymbol.valueDeclaration || exportSymbol.declarations?.[0];
        if (!declaration) continue;

        if (ts.isInterfaceDeclaration(declaration)) {
          const { typeDefinition } = serializeInterface(
            declaration,
            exportSymbol,
            serializerContext,
          );
          if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
            spec.types?.push(typeDefinition);
          }
        } else if (ts.isTypeAliasDeclaration(declaration)) {
          const { typeDefinition } = serializeTypeAlias(
            declaration,
            exportSymbol,
            serializerContext,
          );
          if (typeDefinition && typeRegistry.registerTypeDefinition(typeDefinition)) {
            spec.types?.push(typeDefinition);
          }
        }
      }
    }
  }

  return spec;
}
