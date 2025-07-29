import chalk from 'chalk';

/**
 * Enhanced error messages with helpful context
 */
export const ERROR_ENHANCEMENTS: Record<string, (message: string) => string> = {
  // Type not found errors
  'TS2304': (msg) => `${msg}
  ${chalk.cyan('→')} Make sure the type is imported or defined in the current scope
  ${chalk.cyan('→')} Check for typos in the type name
  ${chalk.cyan('→')} Verify the import path is correct`,

  // Property doesn't exist
  'TS2339': (msg) => `${msg}
  ${chalk.cyan('→')} Check if the property exists on the type
  ${chalk.cyan('→')} Use optional chaining (?.) if the object might be undefined
  ${chalk.cyan('→')} Check for typos in the property name`,

  // Type mismatch
  'TS2345': (msg) => `${msg}
  ${chalk.cyan('→')} The provided type doesn't match the expected type
  ${chalk.cyan('→')} Check the function signature or variable type
  ${chalk.cyan('→')} Consider using type assertions if you're certain about the type`,

  // Property name typo
  'TS2551': (msg) => `${msg}
  ${chalk.cyan('→')} Did you mean a similar property name?
  ${chalk.cyan('→')} Check for typos or case sensitivity issues`,

  // Object is possibly undefined
  'TS2571': (msg) => `${msg}
  ${chalk.cyan('→')} Object may be undefined or null
  ${chalk.cyan('→')} Use optional chaining (?.) or add a null check
  ${chalk.cyan('→')} Consider using type guards`,

  // Index signature missing
  'TS7053': (msg) => `${msg}
  ${chalk.cyan('→')} Add an index signature to the type
  ${chalk.cyan('→')} Use a more specific key type
  ${chalk.cyan('→')} Consider using Map or Record type`,

  // Type assignment error
  'TS2322': (msg) => `${msg}
  ${chalk.cyan('→')} The assigned value doesn't match the expected type
  ${chalk.cyan('→')} Check the variable or parameter type
  ${chalk.cyan('→')} Ensure all required properties are present`,

  // No overload matches
  'TS2769': (msg) => `${msg}
  ${chalk.cyan('→')} No function overload matches the provided arguments
  ${chalk.cyan('→')} Check the number and types of arguments
  ${chalk.cyan('→')} Review available function signatures`,

  // Syntax error
  'TS1005': (msg) => `${msg}
  ${chalk.cyan('→')} Syntax error in TypeScript code
  ${chalk.cyan('→')} Check for missing punctuation (semicolons, commas, brackets)
  ${chalk.cyan('→')} Verify all keywords are spelled correctly`,

  // Module not found
  'TS2307': (msg) => `${msg}
  ${chalk.cyan('→')} Module not found
  ${chalk.cyan('→')} Check the import path and file extension
  ${chalk.cyan('→')} Ensure the module is installed (npm/yarn install)
  ${chalk.cyan('→')} Verify tsconfig.json paths configuration`
};

/**
 * Common resolution errors with helpful messages
 */
export const RESOLUTION_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  enhancement: string;
}> = [
  {
    pattern: /Maximum call stack/i,
    enhancement: `
  ${chalk.yellow('Stack overflow during type resolution')}
  ${chalk.cyan('→')} This usually happens with deeply recursive types
  ${chalk.cyan('→')} Try reducing --max-depth (current limit: 5)
  ${chalk.cyan('→')} Simplify recursive type structures
  ${chalk.cyan('→')} Consider using type aliases to break cycles`
  },
  {
    pattern: /Cannot read prop.* of undefined/i,
    enhancement: `
  ${chalk.cyan('→')} This might indicate a malformed type or missing type information
  ${chalk.cyan('→')} Check if all imported types are available
  ${chalk.cyan('→')} Ensure the TypeScript version is compatible`
  },
  {
    pattern: /Circular reference/i,
    enhancement: `
  ${chalk.cyan('→')} Circular type reference detected
  ${chalk.cyan('→')} Consider using interface extends instead of type intersections
  ${chalk.cyan('→')} Use lazy type evaluation with conditional types`
  },
  {
    pattern: /File .* not found/i,
    enhancement: `
  ${chalk.cyan('→')} Source file not found
  ${chalk.cyan('→')} Check if the file path is correct
  ${chalk.cyan('→')} Ensure the file has the correct extension (.ts, .tsx)
  ${chalk.cyan('→')} Verify the tsconfig.json includes this file`
  }
];

/**
 * Get enhanced error message
 */
export function getEnhancedErrorMessage(code: string, message: string): string {
  const enhancer = ERROR_ENHANCEMENTS[code];
  if (enhancer) {
    return enhancer(message);
  }
  return message;
}

/**
 * Get enhanced resolution error
 */
export function getEnhancedResolutionError(message: string): string {
  for (const { pattern, enhancement } of RESOLUTION_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return `${message}${enhancement}`;
    }
  }
  return message;
}

/**
 * Format error location
 */
export function formatErrorLocation(location: string): string {
  // Extract file, line, column
  const match = location.match(/^(.+):(\d+):(\d+)$/);
  if (match) {
    const [, file, line, col] = match;
    const shortFile = file.split('/').slice(-2).join('/');
    return chalk.cyan(`${shortFile}:${line}:${col}`);
  }
  return chalk.cyan(location);
}

/**
 * Get suggestion for error code
 */
export function getErrorSuggestion(code: string): string | null {
  const suggestions: Record<string, string> = {
    'TS2304': 'Try running: openpkg --verbose to see import resolution details',
    'TS2307': 'Try running: npm install or check your package.json',
    'TS2339': 'Use --include-resolved-types to see the full type structure',
    'TYPE_RESOLUTION_ERROR': 'Try using --use-legacy-parser as a fallback'
  };
  
  return suggestions[code] || null;
}