/**
 * Service for formatting types for output
 */
export class TypeFormatter {
  private static readonly BUILT_IN_TYPES = new Set([
    'string', 'number', 'boolean', 'object', 'any', 'void', 'unknown', 'never',
    'null', 'undefined', 'bigint', 'symbol',
    'Array', 'Promise', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
    'Map', 'Set', 'Error', 'ArrayBuffer', 'Uint8Array', 'ArrayBufferLike', 'BigInt'
  ]);

  /**
   * Create a $ref object for type references
   */
  static createRef(typeName: string): { $ref: string } {
    return { $ref: `#/types/${typeName}` };
  }

  /**
   * Check if a type name is a custom type (not built-in)
   */
  static isCustomType(typeName: string): boolean {
    // NEW: Exclude literals
    if (
      typeName.match(/^\d+(\.\d+)?$/) ||  // Numbers
      typeName.match(/^\d+n$/) ||         // BigInt literals
      typeName.match(/^"[^"]*"$/) ||      // Strings
      typeName === 'true' || typeName === 'false' ||  // Booleans
      typeName === 'null' || typeName === 'undefined'
    ) {
      return false;
    }
    // Exclude single letter type parameters (generic type parameters like T, U, K, V)
    if (typeName.match(/^[A-Z]$/)) {
      return false;
    }
    return !this.BUILT_IN_TYPES.has(typeName);
  }

  /**
   * Clean up type text by removing import() syntax
   */
  static cleanTypeText(typeText: string): string {
    return typeText
      .replace(/import\([^)]+\)\.(\w+)/g, '$1')
      .replace(/typeof import\([^)]+\)\.(\w+)/g, '$1');
  }

  /**
   * Extract type name from complex type strings
   */
  static extractTypeName(typeText: string): string | null {
    // Handle import(...).TypeName pattern
    const importMatch = typeText.match(/import\([^)]+\)\.(\w+)$/);
    if (importMatch) {
      return importMatch[1];
    }
    
    // Check if it's a simple type reference
    const simpleMatch = typeText.match(/^([A-Z]\w*)$/);
    if (simpleMatch) {
      return simpleMatch[1];
    }
    
    return null;
  }

  /**
   * Convert type string to appropriate format (string or $ref)
   */
  static formatForOutput(
    typeStr: string,
    collectedTypes: Map<string, any>
  ): string | { $ref: string } {
    // First, try to extract a type name from the original string
    const typeName = this.extractTypeName(typeStr);
    if (typeName && this.isCustomType(typeName)) {
      // Always create a ref for custom type names, even if not yet in collectedTypes
      // This handles the case where types are collected after functions are processed
      return this.createRef(typeName);
    }
    
    const cleaned = this.cleanTypeText(typeStr);
    
    // NEW: Detect numeric literals and return as string
    if (cleaned.match(/^\d+(\.\d+)?$/)) {
      return cleaned;  // e.g., "3.141592653589793"
    }
    
    // NEW: Detect BigInt literals and return as string
    if (cleaned.match(/^\d+n$/)) {
      return cleaned;  // e.g., "3n", "100n"
    }
    
    // NEW: Detect string literals (with quotes) and return as string
    if (cleaned.match(/^"[^"]*"$/)) {
      return cleaned;  // e.g., "\"hello\""
    }
    
    // NEW: Detect boolean literals and return as string
    if (cleaned === 'true' || cleaned === 'false') {
      return cleaned;  // e.g., "true" or "false"
    }
    
    // NEW: Detect null and undefined literals
    if (cleaned === 'null' || cleaned === 'undefined') {
      return cleaned;
    }
    
    // Check if it's a simple type reference (no generics, unions, etc.)
    const simpleTypeMatch = cleaned.match(/^([A-Z][\w]*)$/);
    if (simpleTypeMatch) {
      const simpleTypeName = simpleTypeMatch[1];
      if (this.isCustomType(simpleTypeName)) {
        // Always create a ref for custom type names
        return this.createRef(simpleTypeName);
      }
    }
    
    // For complex types (like objects), handle them recursively
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      return this.formatComplexType(cleaned, collectedTypes);
    }
    
    // For complex types or unrecognized, return as string
    return cleaned;
  }

  /**
   * Extract type names from a type string or $ref object
   */
  static extractTypeNames(type: string | { $ref: string }): string[] {
    const names = new Set<string>();
    
    // Handle $ref objects
    if (typeof type === 'object' && type.$ref) {
      const match = type.$ref.match(/#\/types\/(\w+)/);
      if (match) {
        names.add(match[1]);
      }
      return Array.from(names);
    }
    
    // Handle string types
    if (typeof type === 'string') {
      const cleaned = this.cleanTypeText(type);
      
      // Match type names (capital letters followed by word characters)
      // But exclude those that are part of camelCase property names
      // Use word boundary to ensure we're matching whole type names
      const matches = cleaned.match(/\b[A-Z]\w+\b/g);
      if (matches) {
        matches.forEach(match => {
          if (this.isCustomType(match)) {
            names.add(match);
          }
        });
      }
    }
    
    return Array.from(names);
  }

  /**
   * Format a resolved type object to string
   */
  static formatResolvedType(typeObj: any): string {
    if (typeof typeObj === 'string') return typeObj;
    
    if (typeObj.kind === 'interface') {
      const props = typeObj.properties.map((p: any) => 
        `${p.name}${p.optional ? '?' : ''}: ${this.formatResolvedType(p.type)}`
      );
      return `{${props.join('; ')}}`;
    }
    
    if (typeObj.kind === 'function') {
      const params = typeObj.parameters.map((p: any) => 
        `${p.name}: ${this.formatResolvedType(p.type)}`
      );
      return `(${params.join(', ')}) => ${this.formatResolvedType(typeObj.returnType)}`;
    }
    
    if (typeObj.type === 'array' && typeObj.elementType) {
      return `${this.formatResolvedType(typeObj.elementType)}[]`;
    }
    
    if (typeObj.kind === 'tuple' && typeObj.elements) {
      return `[${typeObj.elements.map((e: any) => this.formatResolvedType(e)).join(', ')}]`;
    }
    
    return 'unknown';
  }

  /**
   * Normalize type strings (handle array syntax, etc.)
   */
  static normalizeTypeString(typeStr: string): string {
    // Convert Array<T> to T[]
    typeStr = typeStr.replace(/Array<([^>]+)>/g, '$1[]');
    
    // Remove extra whitespace
    typeStr = typeStr.replace(/\s+/g, ' ').trim();
    
    return typeStr;
  }

  /**
   * Format complex types (objects, unions) recursively
   */
  private static formatComplexType(
    typeStr: string,
    collectedTypes: Map<string, any>
  ): string {
    // Handle object types
    if (typeStr.startsWith('{') && typeStr.endsWith('}')) {
      // Extract the content between braces
      const content = typeStr.slice(1, -1).trim();
      
      // Split properties by semicolon or comma (handle both formats)
      const separator = content.includes(';') ? ';' : ',';
      const props = content.split(separator).map(p => p.trim()).filter(p => p);
      
      const formattedProps = props.map(prop => {
        // Match property pattern: "name: type"
        const colonIndex = prop.indexOf(':');
        if (colonIndex === -1) return prop; // Malformed, return as-is
        
        const key = prop.substring(0, colonIndex).trim();
        const value = prop.substring(colonIndex + 1).trim();
        
        // Recursively format the value type
        const formattedValue = this.formatForOutput(value, collectedTypes);
        const valueStr = typeof formattedValue === 'string' 
          ? formattedValue 
          : JSON.stringify(formattedValue);
        
        return `${key}: ${valueStr}`;
      });
      
      return `{${formattedProps.join('; ')}}`;
    }
    
    // Handle array types
    if (typeStr.endsWith('[]')) {
      const elementType = typeStr.slice(0, -2).trim();
      const formattedElement = this.formatForOutput(elementType, collectedTypes);
      const elementStr = typeof formattedElement === 'string' 
        ? formattedElement 
        : JSON.stringify(formattedElement);
      return `${elementStr}[]`;
    }
    
    // Handle union types
    if (typeStr.includes(' | ')) {
      const types = typeStr.split(' | ').map(t => t.trim());
      const formattedTypes = types.map(t => {
        const formatted = this.formatForOutput(t, collectedTypes);
        return typeof formatted === 'string' ? formatted : JSON.stringify(formatted);
      });
      return formattedTypes.join(' | ');
    }
    
    // Handle intersection types
    if (typeStr.includes(' & ')) {
      const types = typeStr.split(' & ').map(t => t.trim());
      const formattedTypes = types.map(t => {
        const formatted = this.formatForOutput(t, collectedTypes);
        return typeof formatted === 'string' ? formatted : JSON.stringify(formatted);
      });
      return formattedTypes.join(' & ');
    }
    
    // Fallback for other complex types
    return typeStr;
  }
}