import chalk from 'chalk';

export interface ProgressOptions {
  total: number;
  label?: string;
  showPercentage?: boolean;
  showCount?: boolean;
  barWidth?: number;
}

export class ProgressBar {
  private current = 0;
  private total: number;
  private label: string;
  private showPercentage: boolean;
  private showCount: boolean;
  private barWidth: number;
  private startTime: number;
  private lastRender = '';

  constructor(options: ProgressOptions) {
    this.total = options.total;
    this.label = options.label ?? '';
    this.showPercentage = options.showPercentage ?? true;
    this.showCount = options.showCount ?? true;
    this.barWidth = options.barWidth ?? 30;
    this.startTime = Date.now();
  }

  update(current: number, label?: string): void {
    this.current = current;
    if (label) this.label = label;
    this.render();
  }

  increment(label?: string): void {
    this.update(this.current + 1, label);
  }

  private render(): void {
    const percentage = Math.min(100, Math.round((this.current / this.total) * 100));
    const filledWidth = Math.round((percentage / 100) * this.barWidth);
    const emptyWidth = this.barWidth - filledWidth;

    const filled = chalk.green('\u2588'.repeat(filledWidth));
    const empty = chalk.dim('\u2591'.repeat(emptyWidth));
    const bar = `${filled}${empty}`;

    const parts: string[] = [];

    if (this.label) {
      parts.push(chalk.cyan(this.label.substring(0, 30).padEnd(30)));
    }

    parts.push(bar);

    if (this.showPercentage) {
      parts.push(chalk.yellow(`${percentage.toString().padStart(3)}%`));
    }

    if (this.showCount) {
      parts.push(chalk.dim(`(${this.current}/${this.total})`));
    }

    const elapsed = Date.now() - this.startTime;
    if (elapsed > 1000 && this.current > 0) {
      const eta = Math.round(((elapsed / this.current) * (this.total - this.current)) / 1000);
      if (eta > 0) {
        parts.push(chalk.dim(`~${eta}s`));
      }
    }

    const output = parts.join(' ');

    if (output !== this.lastRender) {
      process.stdout.write(`\r${output}`);
      this.lastRender = output;
    }
  }

  finish(message?: string): void {
    process.stdout.write(`\r${' '.repeat(this.lastRender.length)}\r`);
    if (message) {
      console.log(message);
    }
  }
}

/**
 * Multi-step progress tracker for sequential operations
 */
export interface Step {
  label: string;
  activeLabel?: string; // e.g., "Analyzing..." vs "Analyze"
}

export class StepProgress {
  private steps: Step[];
  private currentStep = 0;
  private startTime: number;
  private stepStartTime: number;

  constructor(steps: Step[]) {
    this.steps = steps;
    this.startTime = Date.now();
    this.stepStartTime = Date.now();
  }

  start(stepIndex?: number): void {
    this.currentStep = stepIndex ?? 0;
    this.stepStartTime = Date.now();
    this.render();
  }

  next(): void {
    this.completeCurrentStep();
    this.currentStep++;
    if (this.currentStep < this.steps.length) {
      this.stepStartTime = Date.now();
      this.render();
    }
  }

  complete(message?: string): void {
    this.completeCurrentStep();
    if (message) {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      console.log(`${chalk.green('\u2713')} ${message} ${chalk.dim(`(${elapsed}s)`)}`);
    }
  }

  private render(): void {
    const step = this.steps[this.currentStep];
    if (!step) return;

    const label = step.activeLabel ?? step.label;
    const prefix = chalk.dim(`[${this.currentStep + 1}/${this.steps.length}]`);
    process.stdout.write(`\r${prefix} ${chalk.cyan(label)}...`);
  }

  private completeCurrentStep(): void {
    const step = this.steps[this.currentStep];
    if (!step) return;

    const elapsed = ((Date.now() - this.stepStartTime) / 1000).toFixed(1);
    const prefix = chalk.dim(`[${this.currentStep + 1}/${this.steps.length}]`);

    // Clear line and print completed step
    process.stdout.write(`\r${' '.repeat(80)}\r`);
    console.log(`${prefix} ${step.label} ${chalk.green('\u2713')} ${chalk.dim(`(${elapsed}s)`)}`);
  }
}

// Factory functions for common use cases
export function createAnalysisProgress(exportCount: number): ProgressBar {
  return new ProgressBar({
    total: exportCount,
    label: 'Analyzing exports',
    barWidth: 25,
  });
}

export function createExampleValidationProgress(total: number): ProgressBar {
  return new ProgressBar({
    total,
    label: 'Validating examples',
    barWidth: 25,
  });
}
