import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DocCov,
  detectBuildInfo,
  detectEntryPoint,
  detectMonorepo,
  detectPackageManager,
  findPackageByName,
  formatPackageList,
  getInstallCommand,
  NodeFileSystem,
} from '@doccov/sdk';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora, { type Ora } from 'ora';
import { simpleGit } from 'simple-git';
import { buildCloneUrl, buildDisplayUrl, parseGitHubUrl } from '../utils/github-url';
import { generateBuildPlan } from '../utils/llm-build-plan';

export interface ScanCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  spinner?: (text: string) => Ora;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<ScanCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  spinner: (text: string) => ora(text),
  log: console.log,
  error: console.error,
};

interface ScanResult {
  owner: string;
  repo: string;
  ref: string;
  packageName?: string;
  coverage: number;
  exportCount: number;
  typeCount: number;
  driftCount: number;
  undocumented: string[];
  drift: Array<{
    export: string;
    type: string;
    issue: string;
  }>;
}

export function registerScanCommand(
  program: Command,
  dependencies: ScanCommandDependencies = {},
): void {
  const { createDocCov, spinner, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('scan <url>')
    .description('Analyze docs coverage for any public GitHub repository')
    .option('--ref <branch>', 'Branch or tag to analyze')
    .option('--package <name>', 'Target package in monorepo')
    .option('--output <format>', 'Output format: text or json', 'text')
    .option('--no-cleanup', 'Keep cloned repo (for debugging)')
    .option(
      '--skip-install',
      'Skip dependency installation (faster, but may limit type resolution)',
    )
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .option('--save-spec <path>', 'Save full OpenPkg spec to file')
    .action(async (url: string, options) => {
      let tempDir: string | undefined;

      try {
        // Parse GitHub URL
        const parsed = parseGitHubUrl(url, options.ref ?? 'main');
        const cloneUrl = buildCloneUrl(parsed);
        const displayUrl = buildDisplayUrl(parsed);

        log('');
        log(chalk.bold(`Scanning ${displayUrl}`));
        log(chalk.gray(`Branch/tag: ${parsed.ref}`));
        log('');

        // Create temp directory
        tempDir = path.join(
          os.tmpdir(),
          `doccov-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fs.mkdirSync(tempDir, { recursive: true });

        // Clone repository
        const cloneSpinner = spinner(`Cloning ${parsed.owner}/${parsed.repo}...`);
        cloneSpinner.start();

        try {
          const git = simpleGit();
          await git.clone(cloneUrl, tempDir, [
            '--depth',
            '1',
            '--branch',
            parsed.ref,
            '--single-branch',
          ]);
          cloneSpinner.succeed(`Cloned ${parsed.owner}/${parsed.repo}`);
        } catch (cloneError) {
          cloneSpinner.fail('Failed to clone repository');
          const message = cloneError instanceof Error ? cloneError.message : String(cloneError);

          if (message.includes('not found') || message.includes('404')) {
            throw new Error(`Repository not accessible or does not exist: ${displayUrl}`);
          }
          if (message.includes('Could not find remote branch')) {
            throw new Error(`Branch or tag not found: ${parsed.ref}`);
          }
          throw new Error(`Clone failed: ${message}`);
        }

        // Create filesystem abstraction for detection
        const fileSystem = new NodeFileSystem(tempDir);

        // Install dependencies (needed for type resolution)
        if (options.skipInstall) {
          log(chalk.gray('Skipping dependency installation (--skip-install)'));
        } else {
          const installSpinner = spinner('Installing dependencies...');
          installSpinner.start();

          const installErrors: string[] = [];

          try {
            const { execSync } = await import('node:child_process');

            // Detect package manager using SDK
            const pmInfo = await detectPackageManager(fileSystem);
            const installCmd = getInstallCommand(pmInfo);
            const cmdString = installCmd.join(' ');

            let installed = false;

            // Try primary package manager if lockfile exists
            if (pmInfo.lockfile) {
              try {
                execSync(cmdString, {
                  cwd: tempDir,
                  stdio: 'pipe',
                  timeout: 180000,
                });
                installed = true;
              } catch (cmdError) {
                const stderr = (cmdError as { stderr?: Buffer })?.stderr?.toString() ?? '';
                const msg = cmdError instanceof Error ? cmdError.message : String(cmdError);
                installErrors.push(`[${cmdString}] ${stderr.slice(0, 150) || msg.slice(0, 150)}`);
              }
            }

            // Fallback: try bun (fast), then npm with permissive flags
            if (!installed) {
              try {
                execSync('bun install', {
                  cwd: tempDir,
                  stdio: 'pipe',
                  timeout: 120000,
                });
                installed = true;
              } catch (bunError) {
                const stderr = (bunError as { stderr?: Buffer })?.stderr?.toString() ?? '';
                const msg = bunError instanceof Error ? bunError.message : String(bunError);
                installErrors.push(`[bun install] ${stderr.slice(0, 150) || msg.slice(0, 150)}`);

                try {
                  execSync('npm install --legacy-peer-deps --ignore-scripts', {
                    cwd: tempDir,
                    stdio: 'pipe',
                    timeout: 180000,
                  });
                  installed = true;
                } catch (npmError) {
                  const npmStderr = (npmError as { stderr?: Buffer })?.stderr?.toString() ?? '';
                  const npmMsg = npmError instanceof Error ? npmError.message : String(npmError);
                  installErrors.push(
                    `[npm install] ${npmStderr.slice(0, 150) || npmMsg.slice(0, 150)}`,
                  );
                }
              }
            }

            if (installed) {
              installSpinner.succeed('Dependencies installed');
            } else {
              installSpinner.warn('Could not install dependencies (analysis may be limited)');
              for (const err of installErrors) {
                log(chalk.gray(`  ${err}`));
              }
            }
          } catch (outerError) {
            const msg = outerError instanceof Error ? outerError.message : String(outerError);
            installSpinner.warn(`Could not install dependencies: ${msg.slice(0, 100)}`);
            for (const err of installErrors) {
              log(chalk.gray(`  ${err}`));
            }
          }
        }

        // Determine target directory
        let targetDir = tempDir;
        let packageName: string | undefined;

        // Check for monorepo using SDK
        const mono = await detectMonorepo(fileSystem);
        if (mono.isMonorepo) {
          if (!options.package) {
            error('');
            error(
              chalk.red(
                `Monorepo detected with ${mono.packages.length} packages. Specify target with --package:`,
              ),
            );
            error('');
            error(formatPackageList(mono.packages));
            error('');
            throw new Error('Monorepo requires --package flag');
          }

          const pkg = findPackageByName(mono.packages, options.package);
          if (!pkg) {
            error('');
            error(chalk.red(`Package "${options.package}" not found. Available packages:`));
            error('');
            error(formatPackageList(mono.packages));
            error('');
            throw new Error(`Package not found: ${options.package}`);
          }

          targetDir = path.join(tempDir, pkg.path);
          packageName = pkg.name;
          log(chalk.gray(`Analyzing package: ${packageName}`));
        }

        // Detect entry point using SDK
        const entrySpinner = spinner('Detecting entry point...');
        entrySpinner.start();

        let entryPath: string;

        // Create filesystem for target directory (may be different from repo root in monorepo)
        const targetFs = mono.isMonorepo ? new NodeFileSystem(targetDir) : fileSystem;

        // Helper: run LLM fallback
        let buildFailed = false;
        const runLlmFallback = async (reason: string): Promise<string | null> => {
          entrySpinner.text = `${reason}, trying LLM fallback...`;

          const plan = await generateBuildPlan(targetDir);
          if (!plan) {
            return null;
          }

          // Execute any build commands the LLM suggests
          if (plan.buildCommands.length > 0) {
            const { execSync } = await import('node:child_process');
            for (const cmd of plan.buildCommands) {
              log(chalk.gray(`  Running: ${cmd}`));
              try {
                execSync(cmd, { cwd: targetDir, stdio: 'pipe', timeout: 300000 });
              } catch (buildError) {
                buildFailed = true;
                const msg = buildError instanceof Error ? buildError.message : String(buildError);
                // Check for common WASM/Rust errors
                if (msg.includes('rustc') || msg.includes('cargo') || msg.includes('wasm-pack')) {
                  log(chalk.yellow(`  ⚠ Build requires Rust toolchain (not available)`));
                } else if (msg.includes('rimraf') || msg.includes('command not found')) {
                  log(chalk.yellow(`  ⚠ Build failed: missing dependencies`));
                } else {
                  log(chalk.yellow(`  ⚠ Build failed: ${msg.slice(0, 80)}`));
                }
              }
            }
          }

          if (plan.notes) {
            log(chalk.gray(`  Note: ${plan.notes}`));
          }

          return plan.entryPoint;
        };

        try {
          const entry = await detectEntryPoint(targetFs);

          // Use SDK's build info detection for WASM check
          const buildInfo = await detectBuildInfo(targetFs);
          const needsBuildStep = entry.isDeclarationOnly && buildInfo.exoticIndicators.wasm;

          // Check if this .d.ts entry likely needs a build step first
          if (needsBuildStep) {
            entrySpinner.text = 'Detected .d.ts entry with WASM indicators...';

            const llmEntry = await runLlmFallback('WASM project detected');
            if (llmEntry) {
              entryPath = path.join(targetDir, llmEntry);
              if (buildFailed) {
                entrySpinner.succeed(`Entry point: ${llmEntry} (using pre-committed declarations)`);
                log(
                  chalk.gray(
                    '  Coverage may be limited - generated .d.ts files typically lack JSDoc',
                  ),
                );
              } else {
                entrySpinner.succeed(`Entry point: ${llmEntry} (from LLM fallback - WASM project)`);
              }
            } else {
              // Fall back to original .d.ts entry
              entryPath = path.join(targetDir, entry.path);
              entrySpinner.succeed(`Entry point: ${entry.path} (from ${entry.source})`);
              log(
                chalk.yellow('  ⚠ WASM project detected but no API key - analysis may be limited'),
              );
            }
          } else {
            entryPath = path.join(targetDir, entry.path);
            entrySpinner.succeed(`Entry point: ${entry.path} (from ${entry.source})`);
          }
        } catch (entryError) {
          // LLM Fallback for exotic projects (WASM, unusual monorepos, etc.)
          const llmEntry = await runLlmFallback('Heuristics failed');
          if (llmEntry) {
            entryPath = path.join(targetDir, llmEntry);
            entrySpinner.succeed(`Entry point: ${llmEntry} (from LLM fallback)`);
          } else {
            entrySpinner.fail(
              'Could not detect entry point (set OPENAI_API_KEY for smart fallback)',
            );
            throw entryError;
          }
        }

        // Run analysis
        const analyzeSpinner = spinner('Analyzing documentation coverage...');
        analyzeSpinner.start();

        let result: Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>>;
        try {
          const resolveExternalTypes = !options.skipResolve;
          const doccov = createDocCov({ resolveExternalTypes });
          result = await doccov.analyzeFileWithDiagnostics(entryPath);
          analyzeSpinner.succeed('Analysis complete');
        } catch (analysisError) {
          analyzeSpinner.fail('Analysis failed');
          throw analysisError;
        }

        const spec = result.spec;
        const coverageScore = spec.docs?.coverageScore ?? 0;

        // Save full spec if requested
        if (options.saveSpec) {
          const specPath = path.resolve(process.cwd(), options.saveSpec);
          fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
          log(chalk.green(`✓ Saved spec to ${options.saveSpec}`));
        }

        // Collect results
        const undocumented: string[] = [];
        const driftIssues: ScanResult['drift'] = [];

        for (const exp of spec.exports ?? []) {
          const expDocs = exp.docs;
          if (!expDocs) continue;

          if ((expDocs.missing?.length ?? 0) > 0 || (expDocs.coverageScore ?? 0) < 100) {
            undocumented.push(exp.name);
          }

          for (const d of expDocs.drift ?? []) {
            driftIssues.push({
              export: exp.name,
              type: d.type,
              issue: d.issue,
            });
          }
        }

        const scanResult: ScanResult = {
          owner: parsed.owner,
          repo: parsed.repo,
          ref: parsed.ref,
          packageName,
          coverage: coverageScore,
          exportCount: spec.exports?.length ?? 0,
          typeCount: spec.types?.length ?? 0,
          driftCount: driftIssues.length,
          undocumented,
          drift: driftIssues,
        };

        // Output results
        if (options.output === 'json') {
          log(JSON.stringify(scanResult, null, 2));
        } else {
          printTextResult(scanResult, log);
        }
      } catch (commandError) {
        error(
          chalk.red('Error:'),
          commandError instanceof Error ? commandError.message : commandError,
        );
        process.exitCode = 1;
      } finally {
        // Cleanup temp directory (fire-and-forget)
        if (tempDir && options.cleanup !== false) {
          const { spawn } = await import('node:child_process');
          spawn('rm', ['-rf', tempDir], {
            detached: true,
            stdio: 'ignore',
          }).unref();
        } else if (tempDir) {
          log(chalk.gray(`Repo preserved at: ${tempDir}`));
        }
      }
    });
}

function printTextResult(result: ScanResult, log: typeof console.log): void {
  log('');
  log(chalk.bold('DocCov Scan Results'));
  log('─'.repeat(40));

  // Header
  const repoName = result.packageName
    ? `${result.owner}/${result.repo} (${result.packageName})`
    : `${result.owner}/${result.repo}`;
  log(`Repository: ${chalk.cyan(repoName)}`);
  log(`Branch: ${chalk.gray(result.ref)}`);
  log('');

  // Coverage
  const coverageColor =
    result.coverage >= 80 ? chalk.green : result.coverage >= 50 ? chalk.yellow : chalk.red;
  log(chalk.bold('Coverage'));
  log(`  ${coverageColor(`${result.coverage}%`)}`);
  log('');

  // Stats
  log(chalk.bold('Stats'));
  log(`  ${result.exportCount} exports`);
  log(`  ${result.typeCount} types`);
  log(`  ${result.undocumented.length} undocumented`);
  log(`  ${result.driftCount} drift issues`);

  // Undocumented
  if (result.undocumented.length > 0) {
    log('');
    log(chalk.bold('Undocumented Exports'));
    for (const name of result.undocumented.slice(0, 10)) {
      log(chalk.yellow(`  ! ${name}`));
    }
    if (result.undocumented.length > 10) {
      log(chalk.gray(`  ... and ${result.undocumented.length - 10} more`));
    }
  }

  // Drift
  if (result.drift.length > 0) {
    log('');
    log(chalk.bold('Drift Issues'));
    for (const d of result.drift.slice(0, 5)) {
      log(chalk.red(`  • ${d.export}: ${d.issue}`));
    }
    if (result.drift.length > 5) {
      log(chalk.gray(`  ... and ${result.drift.length - 5} more`));
    }
  }

  log('');
}
