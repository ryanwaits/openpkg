import * as ts from 'typescript';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { 
  getEnhancedErrorMessage, 
  getEnhancedResolutionError, 
  formatErrorLocation,
  getErrorSuggestion 
} from '../utils/error-messages';

/**
 * Service for handling and reporting TypeScript compilation and type resolution errors
 */
export class ErrorHandler {
  private errors: TypeResolutionError[] = [];
  private warnings: TypeResolutionWarning[] = [];
  private suppressedErrors = new Set<string>();

  constructor(private options: ErrorHandlerOptions = {}) {
    this.options = {
      maxErrors: 100,
      showWarnings: true,
      throwOnError: false,
      ...options
    };
  }

  /**
   * Handle TypeScript diagnostic
   */
  handleDiagnostic(diagnostic: ts.Diagnostic): void {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    const code = `TS${diagnostic.code}`;
    const enhancedMessage = getEnhancedErrorMessage(code, message);
    const severity = this.getDiagnosticSeverity(diagnostic);

    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const location = `${diagnostic.file.fileName}:${line + 1}:${character + 1}`;

      if (severity === 'error') {
        this.addError({
          code,
          message: enhancedMessage,
          location,
          type: 'typescript-diagnostic',
          node: undefined
        });
      } else if (severity === 'warning' && this.options.showWarnings) {
        this.addWarning({
          code,
          message: enhancedMessage,
          location
        });
      }
    } else {
      // Global diagnostic without file location
      if (severity === 'error') {
        this.addError({
          code,
          message: enhancedMessage,
          type: 'typescript-diagnostic'
        });
      }
    }
  }

  /**
   * Handle type resolution error
   */
  handleTypeResolutionError(error: Error, node?: ts.Node, context?: string): void {
    const location = node ? this.getNodeLocation(node) : undefined;
    const enhancedMessage = getEnhancedResolutionError(error.message);
    
    this.addError({
      code: 'TYPE_RESOLUTION_ERROR',
      message: enhancedMessage,
      location,
      type: 'type-resolution',
      node,
      context,
      stack: error.stack
    });
    
    logger.debug('Type resolution error:', {
      originalMessage: error.message,
      location,
      context,
      stack: error.stack
    });

    if (this.options.throwOnError) {
      throw error;
    }
  }

  /**
   * Handle gracefully with fallback
   */
  handleWithFallback<T>(
    operation: () => T,
    fallback: T,
    context?: string
  ): T {
    try {
      return operation();
    } catch (error) {
      this.addError({
        code: 'OPERATION_FAILED',
        message: (error as Error).message,
        type: 'runtime',
        context
      });
      return fallback;
    }
  }

  /**
   * Add an error
   */
  private addError(error: TypeResolutionError): void {
    const errorKey = `${error.code}:${error.location || 'global'}`;
    
    if (this.suppressedErrors.has(errorKey)) {
      return;
    }

    if (this.errors.length >= this.options.maxErrors!) {
      return;
    }

    this.errors.push({
      ...error,
      timestamp: new Date()
    });
  }

  /**
   * Add a warning
   */
  private addWarning(warning: TypeResolutionWarning): void {
    this.warnings.push({
      ...warning,
      timestamp: new Date()
    });
  }

  /**
   * Get diagnostic severity
   */
  private getDiagnosticSeverity(diagnostic: ts.Diagnostic): 'error' | 'warning' | 'info' {
    switch (diagnostic.category) {
      case ts.DiagnosticCategory.Error:
        return 'error';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Get node location
   */
  private getNodeLocation(node: ts.Node): string {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return `${sourceFile.fileName}:${line + 1}:${character + 1}`;
  }

  /**
   * Get user-friendly error report
   */
  getUserFriendlyReport(): string {
    if (this.errors.length === 0 && this.warnings.length === 0) {
      return chalk.green('✓ No errors or warnings found');
    }

    const lines: string[] = [];
    
    // Error summary
    if (this.errors.length > 0) {
      lines.push(chalk.red.bold(`\nFound ${this.errors.length} error${this.errors.length > 1 ? 's' : ''}:\n`));
      
      // Group errors by code
      const errorsByCode = new Map<string, TypeResolutionError[]>();
      for (const error of this.errors) {
        const errors = errorsByCode.get(error.code) || [];
        errors.push(error);
        errorsByCode.set(error.code, errors);
      }
      
      // Display errors grouped by type
      let errorIndex = 1;
      for (const [code, errors] of errorsByCode) {
        for (const error of errors) {
          lines.push(`${errorIndex}. ${this.formatError(error)}\n`);
          errorIndex++;
        }
      }
    }
    
    // Warning summary
    if (this.warnings.length > 0 && this.options.showWarnings) {
      lines.push(chalk.yellow.bold(`\nFound ${this.warnings.length} warning${this.warnings.length > 1 ? 's' : ''}:\n`));
      
      this.warnings.forEach((warning, index) => {
        lines.push(`${index + 1}. ${this.formatWarning(warning)}\n`);
      });
    }
    
    // Add help text
    lines.push(chalk.gray('\nFor more details, run with --verbose'));
    
    return lines.join('\n');
  }

  /**
   * Suppress specific errors
   */
  suppressError(code: string, location?: string): void {
    const key = location ? `${code}:${location}` : code;
    this.suppressedErrors.add(key);
  }

  /**
   * Clear suppressed errors
   */
  clearSuppressed(): void {
    this.suppressedErrors.clear();
  }

  /**
   * Get all errors
   */
  getErrors(): TypeResolutionError[] {
    return [...this.errors];
  }

  /**
   * Get all warnings
   */
  getWarnings(): TypeResolutionWarning[] {
    return [...this.warnings];
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Clear all errors and warnings
   */
  clear(): void {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Format error for display
   */
  formatError(error: TypeResolutionError): string {
    const parts: string[] = [];

    if (error.location) {
      parts.push(formatErrorLocation(error.location));
    }

    parts.push(chalk.red('error'));
    parts.push(chalk.gray(`[${error.code}]`));
    parts.push(error.message);

    if (error.context) {
      parts.push(chalk.gray(`(${error.context})`));
    }
    
    // Add suggestion if available
    const suggestion = getErrorSuggestion(error.code);
    if (suggestion) {
      parts.push('\n  ' + chalk.yellow('Suggestion:') + ' ' + suggestion);
    }

    return parts.join(' ');
  }

  /**
   * Format warning for display
   */
  formatWarning(warning: TypeResolutionWarning): string {
    const parts: string[] = [];

    if (warning.location) {
      parts.push(chalk.cyan(warning.location));
    }

    parts.push(chalk.yellow('warning'));
    parts.push(chalk.gray(`[${warning.code}]`));
    parts.push(warning.message);

    return parts.join(' ');
  }

  /**
   * Print all errors and warnings to console
   */
  printAll(): void {
    // Print errors
    for (const error of this.errors) {
      console.error(this.formatError(error));
    }

    // Print warnings
    if (this.options.showWarnings) {
      for (const warning of this.warnings) {
        console.warn(this.formatWarning(warning));
      }
    }

    // Summary
    if (this.errors.length > 0 || this.warnings.length > 0) {
      console.log();
      const errorCount = this.errors.length;
      const warningCount = this.warnings.length;
      
      const summary = [];
      if (errorCount > 0) {
        summary.push(chalk.red(`${errorCount} error${errorCount !== 1 ? 's' : ''}`));
      }
      if (warningCount > 0 && this.options.showWarnings) {
        summary.push(chalk.yellow(`${warningCount} warning${warningCount !== 1 ? 's' : ''}`));
      }
      
      console.log(`Found ${summary.join(' and ')}`);
    }
  }

  /**
   * Get error summary
   */
  getSummary(): ErrorSummary {
    const errorsByType = new Map<string, number>();
    const errorsByFile = new Map<string, number>();

    for (const error of this.errors) {
      // Count by type
      errorsByType.set(error.type, (errorsByType.get(error.type) || 0) + 1);
      
      // Count by file
      if (error.location) {
        const file = error.location.split(':')[0];
        errorsByFile.set(file, (errorsByFile.get(file) || 0) + 1);
      }
    }

    return {
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      errorsByType: Object.fromEntries(errorsByType),
      errorsByFile: Object.fromEntries(errorsByFile),
      hasErrors: this.hasErrors()
    };
  }

  /**
   * Create a fallback handler for ts-morph
   */
  createTsMorphFallback(): (error: Error) => void {
    return (error: Error) => {
      this.addWarning({
        code: 'FALLBACK_TO_TSMORPH',
        message: `Falling back to ts-morph due to: ${error.message}`,
        location: undefined
      });
    };
  }
}

export interface ErrorHandlerOptions {
  maxErrors?: number;
  showWarnings?: boolean;
  throwOnError?: boolean;
}

export interface TypeResolutionError {
  code: string;
  message: string;
  location?: string;
  type: 'typescript-diagnostic' | 'type-resolution' | 'runtime';
  node?: ts.Node;
  context?: string;
  stack?: string;
  timestamp?: Date;
}

export interface TypeResolutionWarning {
  code: string;
  message: string;
  location?: string;
  timestamp?: Date;
}

export interface ErrorSummary {
  totalErrors: number;
  totalWarnings: number;
  errorsByType: Record<string, number>;
  errorsByFile: Record<string, number>;
  hasErrors: boolean;
}