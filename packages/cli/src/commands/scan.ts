import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DocCov,
  buildCloneUrl,
  buildDisplayUrl,
  detectBuildInfo,
  detectEntryPoint,
  detectMonorepo,
  detectPackageManager,
  extractSpecSummary,
  findPackageByName,
  formatPackageList,
  getInstallCommand,
  NodeFileSystem,
  parseGitHubUrl,
  type ScanResult,
} from '@doccov/sdk';
import chalk from 'chalk';
import type { Command } from 'commander';
import { simpleGit } from 'simple-git';
import { generateBuildPlan } from '../utils/llm-build-plan';

export interface ScanCommandDependencies {
  createDocCov?: (
    options: ConstructorParameters<typeof DocCov>[0],
  ) => Pick<DocCov, 'analyzeFileWithDiagnostics'>;
  log?: typeof console.log;
  error?: typeof console.error;
}

const defaultDependencies: Required<ScanCommandDependencies> = {
  createDocCov: (options) => new DocCov(options),
  log: console.log,
  error: console.error,
};

export function registerScanCommand(
  program: Command,
  dependencies: ScanCommandDependencies = {},
): void {
  const { createDocCov, log, error } = {
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
        process.stdout.write(chalk.cyan(`> Cloning ${parsed.owner}/${parsed.repo}...\n`));

        try {
          // Configure git with timeout and disable credential prompting
          const git = simpleGit({
            timeout: {
              block: 30000, // 30 second timeout for clone operations
            },
          });

          // Set environment variables to prevent git from prompting for credentials
          const originalEnv = { ...process.env };
          process.env.GIT_TERMINAL_PROMPT = '0'; // Disable credential prompts
          process.env.GIT_ASKPASS = 'echo'; // Prevent password prompts

          try {
            await git.clone(cloneUrl, tempDir, [
              '--depth',
              '1',
              '--branch',
              parsed.ref,
              '--single-branch',
            ]);
          } finally {
            // Restore original environment
            process.env = originalEnv;
          }

          process.stdout.write(chalk.green(`✓ Cloned ${parsed.owner}/${parsed.repo}\n`));
        } catch (cloneError) {
          process.stdout.write(chalk.red('✗ Failed to clone repository\n'));
          const message = cloneError instanceof Error ? cloneError.message : String(cloneError);

          // Check for authentication/permission errors
          if (
            message.includes('Authentication failed') ||
            message.includes('could not read Username') ||
            message.includes('terminal prompts disabled') ||
            message.includes('Invalid username or password') ||
            message.includes('Permission denied')
          ) {
            throw new Error(
              `Authentication required: This repository appears to be private. ` +
                `Public repositories only are currently supported.\n` +
                `Repository: ${displayUrl}`,
            );
          }

          if (message.includes('not found') || message.includes('404')) {
            throw new Error(
              `Repository not accessible or does not exist: ${displayUrl}\n` +
                `Note: Private repositories are not currently supported.`,
            );
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
          process.stdout.write(chalk.cyan('> Installing dependencies...\n'));

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
              process.stdout.write(chalk.green('✓ Dependencies installed\n'));
            } else {
              process.stdout.write(
                chalk.yellow('⚠ Could not install dependencies (analysis may be limited)\n'),
              );
              for (const err of installErrors) {
                log(chalk.gray(`  ${err}`));
              }
            }
          } catch (outerError) {
            const msg = outerError instanceof Error ? outerError.message : String(outerError);
            process.stdout.write(
              chalk.yellow(`⚠ Could not install dependencies: ${msg.slice(0, 100)}\n`),
            );
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
        process.stdout.write(chalk.cyan('> Detecting entry point...\n'));

        let entryPath: string;

        // Create filesystem for target directory (may be different from repo root in monorepo)
        const targetFs = mono.isMonorepo ? new NodeFileSystem(targetDir) : fileSystem;

        // Helper: run LLM fallback
        let buildFailed = false;
        const runLlmFallback = async (reason: string): Promise<string | null> => {
          process.stdout.write(chalk.cyan(`> ${reason}, trying LLM fallback...\n`));

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
            process.stdout.write(chalk.cyan('> Detected .d.ts entry with WASM indicators...\n'));

            const llmEntry = await runLlmFallback('WASM project detected');
            if (llmEntry) {
              entryPath = path.join(targetDir, llmEntry);
              if (buildFailed) {
                process.stdout.write(
                  chalk.green(`✓ Entry point: ${llmEntry} (using pre-committed declarations)\n`),
                );
                log(
                  chalk.gray(
                    '  Coverage may be limited - generated .d.ts files typically lack JSDoc',
                  ),
                );
              } else {
                process.stdout.write(
                  chalk.green(`✓ Entry point: ${llmEntry} (from LLM fallback - WASM project)\n`),
                );
              }
            } else {
              // Fall back to original .d.ts entry
              entryPath = path.join(targetDir, entry.path);
              process.stdout.write(
                chalk.green(`✓ Entry point: ${entry.path} (from ${entry.source})\n`),
              );
              log(
                chalk.yellow('  ⚠ WASM project detected but no API key - analysis may be limited'),
              );
            }
          } else {
            entryPath = path.join(targetDir, entry.path);
            process.stdout.write(
              chalk.green(`✓ Entry point: ${entry.path} (from ${entry.source})\n`),
            );
          }
        } catch (entryError) {
          // LLM Fallback for exotic projects (WASM, unusual monorepos, etc.)
          const llmEntry = await runLlmFallback('Heuristics failed');
          if (llmEntry) {
            entryPath = path.join(targetDir, llmEntry);
            process.stdout.write(chalk.green(`✓ Entry point: ${llmEntry} (from LLM fallback)\n`));
          } else {
            process.stdout.write(
              chalk.red('✗ Could not detect entry point (set OPENAI_API_KEY for smart fallback)\n'),
            );
            throw entryError;
          }
        }

        // Run analysis
        process.stdout.write(chalk.cyan('> Analyzing documentation coverage...\n'));

        let result: Awaited<ReturnType<DocCov['analyzeFileWithDiagnostics']>>;
        try {
          const resolveExternalTypes = !options.skipResolve;
          const doccov = createDocCov({ resolveExternalTypes });
          result = await doccov.analyzeFileWithDiagnostics(entryPath);
          process.stdout.write(chalk.green('✓ Analysis complete\n'));
        } catch (analysisError) {
          process.stdout.write(chalk.red('✗ Analysis failed\n'));
          throw analysisError;
        }

        const spec = result.spec;

        // Save full spec if requested
        if (options.saveSpec) {
          const specPath = path.resolve(process.cwd(), options.saveSpec);
          fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
          log(chalk.green(`✓ Saved spec to ${options.saveSpec}`));
        }

        // Extract summary using SDK utility
        const summary = extractSpecSummary(spec);

        const scanResult: ScanResult = {
          owner: parsed.owner,
          repo: parsed.repo,
          ref: parsed.ref,
          packageName,
          coverage: summary.coverage,
          exportCount: summary.exportCount,
          typeCount: summary.typeCount,
          driftCount: summary.driftCount,
          undocumented: summary.undocumented,
          drift: summary.drift,
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
        // Cleanup temp directory (fire-and-forget, cross-platform)
        if (tempDir && options.cleanup !== false) {
          fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {
            // Ignore cleanup errors
          });
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
