import * as ts from 'typescript';

/**
 * Enhanced symbol resolution for TypeScript Compiler API
 */
export class SymbolResolver {
  constructor(private typeChecker: ts.TypeChecker) {}

  /**
   * Get symbol at a specific location with full resolution
   */
  getSymbolAtLocation(node: ts.Node): ts.Symbol | undefined {
    const symbol = this.typeChecker.getSymbolAtLocation(node);
    
    if (!symbol) {
      return undefined;
    }

    // If it's an alias, get the aliased symbol
    if (symbol.flags & ts.SymbolFlags.Alias) {
      return this.typeChecker.getAliasedSymbol(symbol);
    }

    return symbol;
  }

  /**
   * Extract JSDoc comments from a symbol
   */
  getJSDocComments(symbol: ts.Symbol): JSDocInfo {
    const jsDocInfo: JSDocInfo = {
      description: '',
      tags: [],
      examples: [],
      params: new Map(),
      returns: undefined,
      deprecated: false,
      since: undefined,
      see: []
    };

    // Get the main description
    const docComment = symbol.getDocumentationComment(this.typeChecker);
    jsDocInfo.description = ts.displayPartsToString(docComment);

    // Get JSDoc tags
    const tags = symbol.getJsDocTags();
    
    for (const tag of tags) {
      const tagName = tag.name;
      const tagText = ts.displayPartsToString(tag.text);

      switch (tagName) {
        case 'param':
        case 'parameter':
          const paramMatch = tagText.match(/^(\S+)\s*(.*)$/);
          if (paramMatch) {
            jsDocInfo.params.set(paramMatch[1], paramMatch[2] || '');
          }
          break;
        
        case 'returns':
        case 'return':
          jsDocInfo.returns = tagText;
          break;
        
        case 'example':
          jsDocInfo.examples.push(tagText);
          break;
        
        case 'deprecated':
          jsDocInfo.deprecated = true;
          jsDocInfo.tags.push({ name: tagName, text: tagText });
          break;
        
        case 'since':
          jsDocInfo.since = tagText;
          jsDocInfo.tags.push({ name: tagName, text: tagText });
          break;
        
        case 'see':
          jsDocInfo.see.push(tagText);
          jsDocInfo.tags.push({ name: tagName, text: tagText });
          break;
        
        default:
          jsDocInfo.tags.push({ name: tagName, text: tagText });
      }
    }

    return jsDocInfo;
  }

  /**
   * Get JSDoc from a node (for nodes that might have JSDoc directly)
   */
  getJSDocFromNode(node: ts.Node): JSDocInfo | null {
    const symbol = this.getSymbolAtLocation(node);
    if (!symbol) {
      // Try to get JSDoc directly from the node
      const jsDocs = ts.getJSDocCommentsAndTags(node);
      if (jsDocs.length > 0) {
        return this.parseJSDocNodes(jsDocs);
      }
      return null;
    }

    return this.getJSDocComments(symbol);
  }

  /**
   * Parse JSDoc nodes directly
   */
  private parseJSDocNodes(jsDocNodes: readonly ts.JSDoc[]): JSDocInfo {
    const jsDocInfo: JSDocInfo = {
      description: '',
      tags: [],
      examples: [],
      params: new Map(),
      returns: undefined,
      deprecated: false,
      since: undefined,
      see: []
    };

    for (const jsDoc of jsDocNodes) {
      if (jsDoc.comment) {
        jsDocInfo.description += this.getTextFromJSDocComment(jsDoc.comment) + '\n';
      }

      if (jsDoc.tags) {
        for (const tag of jsDoc.tags) {
          const tagName = tag.tagName.text;
          // For simple tags without comment, extract the text directly
          let tagText = '';
          
          if (tag.comment) {
            tagText = this.getTextFromJSDocComment(tag.comment);
          } else if ('text' in tag && tag.text) {
            // Some tags store their content in the text property
            tagText = tag.text.trim();
          } else {
            // Try to get the text after the tag name
            const fullText = tag.getText();
            const tagMatch = fullText.match(new RegExp(`@${tagName}\\s*(.*)$`));
            if (tagMatch) {
              tagText = tagMatch[1].trim();
            }
          }

          if (ts.isJSDocParameterTag(tag)) {
            const paramName = tag.name.getText();
            jsDocInfo.params.set(paramName, tagText);
          } else if (ts.isJSDocReturnTag(tag)) {
            jsDocInfo.returns = tagText;
          } else if (ts.isJSDocDeprecatedTag(tag)) {
            jsDocInfo.deprecated = true;
            jsDocInfo.tags.push({ name: tagName, text: tagText });
          } else {
            // Handle special tags
            switch (tagName) {
              case 'example':
                jsDocInfo.examples.push(tagText);
                break;
              case 'since':
                jsDocInfo.since = tagText;
                break;
              case 'see':
                jsDocInfo.see.push(tagText || 'unknown');
                break;
            }
            jsDocInfo.tags.push({ name: tagName, text: tagText });
          }
        }
      }
    }

    jsDocInfo.description = jsDocInfo.description.trim();
    return jsDocInfo;
  }

  private getTextFromJSDocComment(comment: string | ts.NodeArray<ts.JSDocComment>): string {
    if (typeof comment === 'string') {
      return comment;
    }
    
    if (!comment || comment.length === 0) {
      return '';
    }
    
    return comment.map(c => c.text).join('');
  }

  /**
   * Handle symbol aliases (imports, exports, etc.)
   */
  resolveAlias(symbol: ts.Symbol): ts.Symbol {
    if (symbol.flags & ts.SymbolFlags.Alias) {
      return this.typeChecker.getAliasedSymbol(symbol);
    }
    return symbol;
  }

  /**
   * Get all symbols that are merged with this symbol (declaration merging)
   */
  getMergedSymbols(symbol: ts.Symbol): ts.Symbol[] {
    const mergedSymbols: ts.Symbol[] = [symbol];
    
    // Check if this symbol has multiple declarations (merged)
    if (symbol.declarations && symbol.declarations.length > 1) {
      // Group declarations by their containing source file
      const declarationsByFile = new Map<ts.SourceFile, ts.Declaration[]>();
      
      for (const decl of symbol.declarations) {
        const sourceFile = decl.getSourceFile();
        if (!declarationsByFile.has(sourceFile)) {
          declarationsByFile.set(sourceFile, []);
        }
        declarationsByFile.get(sourceFile)!.push(decl);
      }

      // If declarations span multiple files or locations, they're merged
      if (declarationsByFile.size > 1 || this.hasMultipleDeclarationKinds(symbol.declarations)) {
        // Return the original symbol as it represents all merged declarations
        return mergedSymbols;
      }
    }

    return mergedSymbols;
  }

  private hasMultipleDeclarationKinds(declarations: ts.Declaration[]): boolean {
    const kinds = new Set(declarations.map(d => d.kind));
    return kinds.size > 1;
  }

  /**
   * Check if a symbol represents a declaration merge
   */
  isDeclarationMerge(symbol: ts.Symbol): boolean {
    if (!symbol.declarations || symbol.declarations.length <= 1) {
      return false;
    }

    // Check for interface + interface merge
    const interfaceDecls = symbol.declarations.filter(d => ts.isInterfaceDeclaration(d));
    if (interfaceDecls.length > 1) {
      return true;
    }

    // Check for namespace + other declaration merge
    const hasNamespace = symbol.declarations.some(d => ts.isModuleDeclaration(d));
    const hasInterface = symbol.declarations.some(d => ts.isInterfaceDeclaration(d));
    const hasOther = symbol.declarations.some(d => 
      ts.isClassDeclaration(d) || 
      ts.isFunctionDeclaration(d) || 
      ts.isEnumDeclaration(d)
    );
    
    // Interface + namespace is a common merge pattern
    if (hasInterface && hasNamespace) {
      return true;
    }
    
    return hasNamespace && hasOther;
  }

  /**
   * Get the origin of an aliased symbol (where it was originally defined)
   */
  getSymbolOrigin(symbol: ts.Symbol): SymbolOrigin | null {
    const aliasedSymbol = this.resolveAlias(symbol);
    
    if (!aliasedSymbol.declarations || aliasedSymbol.declarations.length === 0) {
      return null;
    }

    const declaration = aliasedSymbol.declarations[0];
    const sourceFile = declaration.getSourceFile();
    
    return {
      fileName: sourceFile.fileName,
      line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1,
      character: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).character + 1,
      moduleName: this.getModuleName(sourceFile)
    };
  }

  private getModuleName(sourceFile: ts.SourceFile): string | undefined {
    // Try to infer module name from file path
    const fileName = sourceFile.fileName;
    
    // Check if it's in node_modules
    const nodeModulesIndex = fileName.lastIndexOf('node_modules');
    if (nodeModulesIndex !== -1) {
      const afterNodeModules = fileName.substring(nodeModulesIndex + 'node_modules'.length + 1);
      const parts = afterNodeModules.split(/[\/\\]/);
      
      // Handle scoped packages
      if (parts[0].startsWith('@')) {
        return `${parts[0]}/${parts[1]}`;
      }
      return parts[0];
    }

    return undefined;
  }

  /**
   * Get all exported symbols from a source file
   */
  getExportedSymbols(sourceFile: ts.SourceFile): Map<string, ts.Symbol> {
    const exports = new Map<string, ts.Symbol>();
    const fileSymbol = this.typeChecker.getSymbolAtLocation(sourceFile);

    if (fileSymbol) {
      const exportSymbols = this.typeChecker.getExportsOfModule(fileSymbol);
      
      for (const symbol of exportSymbols) {
        exports.set(symbol.getName(), symbol);
      }
    }

    return exports;
  }

  /**
   * Check if a symbol is exported
   */
  isExported(symbol: ts.Symbol): boolean {
    if (!symbol.declarations || symbol.declarations.length === 0) {
      return false;
    }

    return symbol.declarations.some(decl => {
      // Check for export modifier
      const modifiers = ts.getCombinedModifierFlags(decl as ts.Declaration);
      if (modifiers & ts.ModifierFlags.Export) {
        return true;
      }

      // Check if it's part of an export statement
      let parent = decl.parent;
      while (parent) {
        if (ts.isSourceFile(parent)) {
          break;
        }
        if (ts.isExportDeclaration(parent) || ts.isExportAssignment(parent)) {
          return true;
        }
        parent = parent.parent;
      }

      return false;
    });
  }
}

export interface JSDocInfo {
  description: string;
  tags: Array<{ name: string; text: string }>;
  examples: string[];
  params: Map<string, string>;
  returns?: string;
  deprecated: boolean;
  since?: string;
  see: string[];
}

export interface SymbolOrigin {
  fileName: string;
  line: number;
  character: number;
  moduleName?: string;
}