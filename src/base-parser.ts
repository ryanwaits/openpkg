// src/base-parser.ts
import { Project, SourceFile, Node } from 'ts-morph';
import { TypeFormatter } from './services/type-formatter'; // Reused
import { z } from 'zod';
import { openPkgSchema } from './types/openpkg'; // Reused
import fs from 'fs';
import path from 'path';

export function generateBaseSpec(entryFile: string): z.infer<typeof openPkgSchema> {
  const project = new Project({ /* minimal config */ });
  const sourceFile = project.addSourceFileAtPath(entryFile);

  // Basic extraction: Find exports, signatures, create $refs for types
  const exports: z.infer<typeof openPkgSchema>['exports'] = [];
  const types: z.infer<typeof openPkgSchema>['types'] = [];
  const typeNames = new Set<string>();
  
  for (const [name, decls] of sourceFile.getExportedDeclarations()) {
    const decl = decls[0];
    // Simple handling for functions/classes (expand as needed, but keep light)
    if (Node.isFunctionDeclaration(decl)) {
      const signature = decl.getSignature();
      if (signature) {
        const parameters = decl.getParameters().map(param => {
          const typeText = TypeFormatter.cleanTypeText(param.getType().getText());
          return {
            name: param.getName(),
            type: TypeFormatter.createRef(typeText),
            optional: param.hasQuestionToken() || param.hasInitializer(),
            description: ''
          };
        });

        exports.push({
          id: name,
          name,
          kind: 'function',
          signatures: [{
            parameters,
            returnType: TypeFormatter.createRef(TypeFormatter.cleanTypeText(signature.getReturnType().getText()))
          }],
          description: decl.getJsDocs()[0]?.getDescription() || '',
          examples: [],
          source: { file: entryFile, line: decl.getStartLineNumber() },
          flags: {},
          tags: []
        });
      }
    } else if (Node.isInterfaceDeclaration(decl)) {
      // Add interface to types array
      types.push({
        id: name,
        name,
        kind: 'interface',
        properties: decl.getProperties().map(prop => ({
          name: prop.getName(),
          type: TypeFormatter.cleanTypeText(prop.getType().getText()),
          optional: prop.hasQuestionToken() || false,
          description: ''
        })),
        description: decl.getJsDocs()[0]?.getDescription() || '',
        source: {
          file: entryFile,
          line: decl.getStartLineNumber()
        }
      });
      typeNames.add(name);
    } else if (Node.isTypeAliasDeclaration(decl)) {
      // Add type alias to types array
      const typeNode = decl.getTypeNode();
      types.push({
        id: name,
        name,
        kind: 'type',
        type: typeNode ? TypeFormatter.cleanTypeText(typeNode.getText()) : 'unknown',
        description: decl.getJsDocs()[0]?.getDescription() || '',
        source: {
          file: entryFile,
          line: decl.getStartLineNumber()
        }
      });
      typeNames.add(name);
    }
    // Add $refs for dependent types (no inline resolution)
  }

  // For meta: Improve inference
  const pkgPath = path.resolve(path.dirname(entryFile), 'package.json');
  let pkg = { name: 'unknown', version: '1.0.0', description: '', license: '', repository: { url: '' } };
  if (fs.existsSync(pkgPath)) {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  }
  
  const spec = {
    openpkg: '1.0.0' as const,
    meta: { 
      name: pkg.name,
      version: pkg.version,
      ecosystem: 'js/ts' as const,
      description: pkg.description,
      license: pkg.license,
      repository: pkg.repository?.url
    },
    exports,
    types
  };

  return spec;
}