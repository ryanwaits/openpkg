import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LoggerOptions {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private prefix: string = '';
  private timestamp: boolean = false;

  configure(options: Partial<LoggerOptions>): void {
    if (options.level !== undefined) {
      this.level = options.level;
    }
    if (options.prefix !== undefined) {
      this.prefix = options.prefix;
    }
    if (options.timestamp !== undefined) {
      this.timestamp = options.timestamp;
    }
  }

  setVerbose(verbose: boolean): void {
    this.level = verbose ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private formatMessage(level: string, message: string): string {
    const parts: string[] = [];
    
    if (this.timestamp) {
      parts.push(chalk.gray(new Date().toISOString()));
    }
    
    if (this.prefix) {
      parts.push(chalk.cyan(`[${this.prefix}]`));
    }
    
    parts.push(level);
    parts.push(message);
    
    return parts.join(' ');
  }

  error(message: string, error?: Error): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatMessage(chalk.red('[ERROR]'), message));
      if (error && this.level >= LogLevel.DEBUG) {
        console.error(chalk.gray(error.stack || error.message));
      }
    }
  }

  warn(message: string): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage(chalk.yellow('[WARN]'), message));
    }
  }

  info(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(this.formatMessage(chalk.blue('[INFO]'), message));
    }
  }

  debug(message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(this.formatMessage(chalk.gray('[DEBUG]'), message));
      if (data !== undefined) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }
    }
  }

  trace(message: string, data?: any): void {
    if (this.level >= LogLevel.TRACE) {
      console.log(this.formatMessage(chalk.gray('[TRACE]'), message));
      if (data !== undefined) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }
    }
  }

  group(label: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.group(chalk.cyan(label));
    }
  }

  groupEnd(): void {
    if (this.level >= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  time(label: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.time(chalk.cyan(label));
    }
  }

  timeEnd(label: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.timeEnd(chalk.cyan(label));
    }
  }

  // Progress indicator for long operations
  progress(current: number, total: number, message: string): void {
    if (this.level >= LogLevel.INFO) {
      const percentage = Math.round((current / total) * 100);
      const bar = this.createProgressBar(percentage);
      process.stdout.write(`\r${chalk.cyan('[PROGRESS]')} ${bar} ${percentage}% - ${message}`);
      if (current === total) {
        process.stdout.write('\n');
      }
    }
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${chalk.green('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))}]`;
  }

  // Type resolution specific logging
  typeResolution(message: string, type?: string): void {
    if (this.level >= LogLevel.DEBUG) {
      const typeInfo = type ? chalk.yellow(` <${type}>`) : '';
      console.log(this.formatMessage(chalk.magenta('[TYPE]'), message + typeInfo));
    }
  }

  // Cache specific logging
  cache(action: 'hit' | 'miss' | 'store' | 'evict', key: string): void {
    if (this.level >= LogLevel.TRACE) {
      const actionColor = action === 'hit' ? chalk.green : 
                         action === 'miss' ? chalk.yellow :
                         action === 'store' ? chalk.blue : chalk.red;
      console.log(this.formatMessage(chalk.cyan('[CACHE]'), `${actionColor(action.toUpperCase())} ${key}`));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logError = (message: string, error?: Error) => logger.error(message, error);
export const logWarn = (message: string) => logger.warn(message);
export const logInfo = (message: string) => logger.info(message);
export const logDebug = (message: string, data?: any) => logger.debug(message, data);
export const logTrace = (message: string, data?: any) => logger.trace(message, data);