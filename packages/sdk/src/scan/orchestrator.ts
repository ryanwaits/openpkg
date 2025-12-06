/**
 * Scan orchestrator - coordinates the entire scan workflow.
 * Used by CLI and API to run documentation coverage scans.
 */

import type { OpenPkg } from '@openpkg-ts/spec';
import type { FileSystem } from '../detect/types';
import { detectBuildInfo, getPrimaryBuildScript } from '../detect/build';
import { detectMonorepo, findPackageByName } from '../detect/monorepo';
import { detectEntryPoint } from '../detect/entry-point';
import { type CommandRunner, type InstallResult, installDependencies } from '../install';
import { parseGitHubUrl, type ParsedGitHubUrl } from '../github';
import { DocCov } from '../openpkg';
import type { ProgressCallback, ProgressEvent, ScanOptions, ScanResult } from './types';
import { extractSpecSummary } from './summary';

/**
 * Options for creating a ScanOrchestrator.
 */
export interface ScanOrchestratorOptions {
  /** Progress callback for status updates */
  onProgress?: ProgressCallback;
  /** Command runner for executing shell commands */
  commandRunner?: CommandRunner;
  /** Skip external type resolution */
  skipResolve?: boolean;
}

/**
 * Context for the current scan operation.
 */
export interface ScanContext {
  /** Parsed GitHub URL info */
  parsed: ParsedGitHubUrl;
  /** Target package name for monorepos */
  packageName?: string;
  /** Working directory for the scan */
  workDir: string;
  /** Entry point file path */
  entryFile?: string;
}

/**
 * Orchestrates the scan workflow.
 *
 * The orchestrator coordinates:
 * 1. Repository cloning (for remote URLs)
 * 2. Monorepo detection and package resolution
 * 3. Entry point detection
 * 4. Dependency installation
 * 5. Build execution (if needed)
 * 6. Documentation analysis
 * 7. Summary extraction
 *
 * It's designed to be FileSystem-agnostic so it works with both:
 * - NodeFileSystem (CLI - local execution)
 * - SandboxFileSystem (API - isolated execution)
 *
 * @example
 * ```typescript
 * import { ScanOrchestrator, NodeFileSystem, createNodeCommandRunner } from '@doccov/sdk';
 *
 * const fs = new NodeFileSystem('/path/to/repo');
 * const orchestrator = new ScanOrchestrator(fs, {
 *   commandRunner: createNodeCommandRunner(),
 *   onProgress: (event) => console.log(event.message),
 * });
 *
 * const result = await orchestrator.scan({
 *   url: 'https://github.com/owner/repo',
 *   ref: 'main',
 * });
 *
 * console.log(`Coverage: ${result.coverage}%`);
 * ```
 */
export class ScanOrchestrator {
  private readonly fs: FileSystem;
  private readonly options: ScanOrchestratorOptions;

  constructor(fs: FileSystem, options: ScanOrchestratorOptions = {}) {
    this.fs = fs;
    this.options = options;
  }

  /**
   * Emit a progress event.
   */
  private emit(event: ProgressEvent): void {
    this.options.onProgress?.(event);
  }

  /**
   * Detect monorepo and resolve target package.
   *
   * @param packageName - Target package name (required for monorepos)
   * @returns Target directory path (relative to workDir)
   * @throws Error if monorepo requires --package flag
   */
  async detectPackage(packageName?: string): Promise<{ targetPath: string; resolvedPackage?: string }> {
    this.emit({ stage: 'detecting', message: 'Detecting project structure...', progress: 10 });

    const mono = await detectMonorepo(this.fs);

    if (mono.isMonorepo) {
      if (!packageName) {
        const publicPackages = mono.packages.filter((p) => !p.private);
        throw new MonorepoRequiresPackageError(publicPackages.map((p) => p.name));
      }

      const pkg = findPackageByName(mono.packages, packageName);
      if (!pkg) {
        throw new Error(
          `Package "${packageName}" not found. Available: ${mono.packages.map((p) => p.name).join(', ')}`,
        );
      }

      this.emit({ stage: 'detecting', message: `Found package: ${pkg.name}`, progress: 15 });
      return { targetPath: pkg.path, resolvedPackage: pkg.name };
    }

    return { targetPath: '.' };
  }

  /**
   * Detect entry point for the package.
   *
   * @param targetPath - Path to the package directory
   * @returns Entry point file path (relative to workDir)
   */
  async detectEntry(targetPath: string): Promise<string> {
    this.emit({ stage: 'detecting', message: 'Detecting entry point...', progress: 18 });

    const entry = await detectEntryPoint(this.fs, targetPath);
    const entryFile = targetPath === '.' ? entry.path : `${targetPath}/${entry.path}`;

    this.emit({
      stage: 'detecting',
      message: `Entry point: ${entry.path} (from ${entry.source})`,
      progress: 20,
    });

    return entryFile;
  }

  /**
   * Install dependencies for the project.
   *
   * @param workDir - Working directory (absolute path)
   * @returns Installation result
   */
  async install(workDir: string): Promise<InstallResult> {
    if (!this.options.commandRunner) {
      // Skip install if no command runner provided
      return {
        success: false,
        packageManager: 'npm',
        error: 'No command runner provided',
      };
    }

    this.emit({ stage: 'installing', message: 'Installing dependencies...', progress: 25 });

    const result = await installDependencies(this.fs, workDir, this.options.commandRunner, {
      onProgress: this.options.onProgress,
    });

    if (result.success) {
      this.emit({ stage: 'installing', message: 'Dependencies installed', progress: 45 });
    } else {
      this.emit({
        stage: 'installing',
        message: 'Install failed (continuing with limited analysis)',
        progress: 45,
      });
    }

    return result;
  }

  /**
   * Run build if needed.
   *
   * @param workDir - Working directory (absolute path)
   * @param targetPath - Target package path (relative)
   */
  async build(workDir: string, targetPath: string): Promise<void> {
    if (!this.options.commandRunner) return;

    const buildInfo = await detectBuildInfo(this.fs, targetPath);
    const buildScript = getPrimaryBuildScript(buildInfo);

    if (!buildScript) return;

    this.emit({ stage: 'building', message: 'Running build...', progress: 50 });

    const result = await this.options.commandRunner('npm', ['run', buildScript], {
      cwd: workDir,
      timeout: 300000,
    });

    const buildMessage = result.exitCode === 0 ? 'Build complete' : 'Build failed (continuing)';
    this.emit({ stage: 'building', message: buildMessage, progress: 60 });
  }

  /**
   * Run documentation analysis.
   *
   * @param entryFile - Path to entry file (absolute)
   * @returns OpenPkg spec
   */
  async analyze(entryFile: string): Promise<OpenPkg> {
    this.emit({ stage: 'analyzing', message: 'Analyzing documentation...', progress: 65 });

    const doccov = new DocCov({ resolveExternalTypes: !this.options.skipResolve });
    const result = await doccov.analyzeFileWithDiagnostics(entryFile);

    this.emit({ stage: 'analyzing', message: 'Analysis complete', progress: 90 });

    return result.spec as OpenPkg;
  }

  /**
   * Run a complete scan workflow.
   *
   * @param options - Scan options
   * @returns Scan result with coverage statistics
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    // Parse URL
    const parsed = parseGitHubUrl(options.url, options.ref ?? 'main');

    this.emit({
      stage: 'detecting',
      message: `Scanning ${parsed.owner}/${parsed.repo}...`,
      progress: 5,
    });

    // Detect package (for monorepos)
    const { targetPath, resolvedPackage } = await this.detectPackage(options.package);

    // Detect entry point
    const entryFile = await this.detectEntry(targetPath);

    // Install dependencies (if command runner provided and not skipped)
    if (!options.skipInstall && this.options.commandRunner) {
      // Note: workDir needs to be provided by the caller or detected
      // For now we use '.' as relative path - actual absolute path handling
      // happens in CLI/API when they construct the orchestrator
      await this.install('.');
      await this.build('.', targetPath);
    }

    // Run analysis
    const spec = await this.analyze(entryFile);

    // Extract summary
    this.emit({ stage: 'complete', message: 'Extracting results...', progress: 95 });
    const summary = extractSpecSummary(spec);

    this.emit({ stage: 'complete', message: 'Scan complete', progress: 100 });

    return {
      owner: parsed.owner,
      repo: parsed.repo,
      ref: parsed.ref,
      packageName: resolvedPackage ?? options.package,
      coverage: summary.coverage,
      exportCount: summary.exportCount,
      typeCount: summary.typeCount,
      driftCount: summary.driftCount,
      undocumented: summary.undocumented,
      drift: summary.drift,
    };
  }
}

/**
 * Error thrown when a monorepo is detected but no package is specified.
 */
export class MonorepoRequiresPackageError extends Error {
  /** Available package names */
  readonly availablePackages: string[];

  constructor(availablePackages: string[]) {
    super(
      `Monorepo detected with ${availablePackages.length} packages. ` +
        `Specify target with --package. Available: ${availablePackages.join(', ')}`,
    );
    this.name = 'MonorepoRequiresPackageError';
    this.availablePackages = availablePackages;
  }
}

