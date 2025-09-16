import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import {
  analyzeRemote,
  RemoteAnalysisError,
  type RemoteAnalysisRequestOptions,
  type RemoteAnalysisResponse,
} from 'openpkg-sdk';

export interface AnalyzeCommandDependencies {
  analyzeRemote?: (
    options: RemoteAnalysisRequestOptions,
  ) => Promise<RemoteAnalysisResponse>;
  spinner?: (text: string) => ora.Ora;
  log?: typeof console.log;
  warn?: typeof console.warn;
  error?: typeof console.error;
}

const defaultDependencies: Required<AnalyzeCommandDependencies> = {
  analyzeRemote,
  spinner: (text: string) => ora(text),
  log: console.log,
  warn: console.warn,
  error: console.error,
};

export function registerAnalyzeCommand(
  program: Command,
  dependencies: AnalyzeCommandDependencies = {},
): void {
  const { analyzeRemote: analyzeRemoteImpl, spinner, log, warn, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('analyze <url>')
    .description('Analyze TypeScript code from a GitHub URL')
    .option('-o, --output <file>', 'Output file for OpenPkg spec', 'openpkg.json')
    .option(
      '--show <items>',
      'What to display: spec (default), imports, summary, debug (comma-separated)',
      'spec',
    )
    .option('--follow <items>', 'What to follow: imports (comma-separated)')
    .option('--max-depth <depth>', 'Maximum depth for import resolution', '5')
    .action(async (url, options) => {
      try {
        const showItems = options.show.split(',').map((s: string) => s.trim());
        const followItems = options.follow
          ? options.follow.split(',').map((s: string) => s.trim())
          : [];

        const validShowItems = ['spec', 'imports', 'summary', 'debug'];
        const invalidShow = showItems.filter((item) => !validShowItems.includes(item));
        if (invalidShow.length > 0) {
          error(chalk.red(`Invalid --show values: ${invalidShow.join(', ')}`));
          log(chalk.gray(`Valid options: ${validShowItems.join(', ')}`));
          process.exit(1);
        }

        const validFollowItems = ['imports'];
        const invalidFollow = followItems.filter((item) => !validFollowItems.includes(item));
        if (invalidFollow.length > 0) {
          error(chalk.red(`Invalid --follow values: ${invalidFollow.join(', ')}`));
          log(chalk.gray(`Valid options: ${validFollowItems.join(', ')}`));
          process.exit(1);
        }

        warn(chalk.yellow('⚠️  Remote analysis fetches live code. Ensure you trust the source before running.'));

        const fetchSpinner = spinner(`Fetching ${path.basename(url)}...`);
        fetchSpinner.start();

        try {
          const requestOptions: RemoteAnalysisRequestOptions = {
            source: url,
          };

          if (followItems.includes('imports')) {
            requestOptions.followImports = true;
          }

          if (options.maxDepth !== '5') {
            requestOptions.maxDepth = Number.parseInt(options.maxDepth, 10);
          }

          const data = await analyzeRemoteImpl(requestOptions);

          fetchSpinner.succeed(`Fetched ${path.basename(url)}`);

          if (followItems.includes('imports') && data.metadata?.dependencyGraph) {
            const graph = data.metadata.dependencyGraph;
            log('');
            log(chalk.bold('Dependency Graph:'));
            log(chalk.gray(`├── Total files: ${graph.totalFiles}`));
            log(chalk.gray(`├── Analyzed: ${graph.analyzedFiles}`));
            if (graph.errorFiles > 0) {
              log(chalk.yellow(`├── Errors: ${graph.errorFiles}`));
            }
            log(chalk.gray(`├── Total imports: ${graph.totalImports}`));
            log(chalk.gray(`└── Max depth reached: ${graph.maxDepth}`));

            const specifiedDepth = Number.parseInt(options.maxDepth, 10);
            if (graph.actualMaxDepth !== undefined && graph.actualMaxDepth < specifiedDepth) {
              log('');
              log(
                chalk.blue(
                  `ℹ  Analyzed imports up to depth ${graph.actualMaxDepth} (max specified: ${specifiedDepth})`,
                ),
              );
              log(chalk.gray(`   No imports found beyond depth ${graph.actualMaxDepth}`));
            }

            if (showItems.includes('summary') && data.files) {
              log('');
              log(chalk.bold('Files analyzed:'));
              const fileUrls = Object.keys(data.files);
              fileUrls.forEach((fileUrl, index) => {
                const isLast = index === fileUrls.length - 1;
                const fileName = path.basename(fileUrl);
                log(`${isLast ? '└──' : '├──'} ${fileName}`);
              });
            }
            log('');
          }

          if (showItems.includes('imports')) {
            if (data.parseErrors && data.parseErrors.length > 0) {
              warn(chalk.yellow('\n⚠️  Parse errors detected:\n'));
              for (const parseError of data.parseErrors) {
                if (parseError.line && parseError.column) {
                  warn(
                    chalk.yellow(
                      `  Line ${parseError.line}, Column ${parseError.column}: ${parseError.message}`,
                    ),
                  );
                } else if (parseError.line) {
                  warn(chalk.yellow(`  Line ${parseError.line}: ${parseError.message}`));
                } else {
                  warn(chalk.yellow(`  ${parseError.message}`));
                }
              }
              log('');
            }

            const relativeImports = data.imports?.filter((imp) => imp.type === 'relative') ?? [];
            const packageImports = data.imports?.filter((imp) => imp.type === 'package') ?? [];
            const absoluteImports = data.imports?.filter((imp) => imp.type === 'absolute') ?? [];

            if (relativeImports.length > 0 || packageImports.length > 0 || absoluteImports.length > 0) {
              log(chalk.bold('Imports:'));

              if (relativeImports.length > 0) {
                log(`├── ${chalk.cyan('Relative')} (${relativeImports.length})`);
                relativeImports.forEach((imp, index) => {
                  const isLast =
                    index === relativeImports.length - 1 &&
                    packageImports.length === 0 &&
                    absoluteImports.length === 0;
                  const prefix = isLast ? '    └──' : '│   ├──';
                  let importInfo = imp.path;

                  if (imp.isTypeOnly) {
                    importInfo += chalk.gray(' (type-only)');
                  }

                  const importCount =
                    (imp.importedNames?.length || 0) +
                    (imp.defaultImport ? 1 : 0) +
                    (imp.namespaceImport ? 1 : 0);

                  if (importCount > 0) {
                    importInfo += chalk.gray(` [${importCount} import${importCount > 1 ? 's' : ''}]`);
                  }

                  log(`${prefix} ${importInfo}`);
                });
              }

              if (packageImports.length > 0) {
                const hasAbsolute = absoluteImports.length > 0;
                log(`${hasAbsolute ? '├──' : '└──'} ${chalk.green('Package')} (${packageImports.length})`);
                packageImports.forEach((imp, index) => {
                  const isLast = index === packageImports.length - 1 && !hasAbsolute;
                  const prefix = isLast ? '    └──' : hasAbsolute ? '│   ├──' : '    ├──';
                  let importInfo = imp.path;

                  if (imp.defaultImport) {
                    importInfo += chalk.gray(' [default import]');
                  } else if (imp.namespaceImport) {
                    importInfo += chalk.gray(' [namespace import]');
                  } else if (imp.importedNames && imp.importedNames.length > 0) {
                    importInfo += chalk.gray(` [${imp.importedNames.length} named imports]`);
                  }

                  log(`${prefix} ${importInfo}`);
                });
              }

              if (absoluteImports.length > 0) {
                log(`└── ${chalk.yellow('Absolute')} (${absoluteImports.length})`);
                absoluteImports.forEach((imp, index) => {
                  const isLast = index === absoluteImports.length - 1;
                  const prefix = isLast ? '    └──' : '    ├──';
                  log(`${prefix} ${imp.path}`);
                });
              }

              if (data.parseErrors && data.parseErrors.length > 0) {
                log(chalk.gray('\nImports found before errors'));
              }
            } else {
              log(chalk.gray('No imports found'));
            }
          }

          if (showItems.includes('spec')) {
            if (data.spec) {
              const parseSpinner = spinner('Parsing TypeScript...');
              parseSpinner.start();
              parseSpinner.succeed();

              const specSpinner = spinner('Generating OpenPkg spec...');
              specSpinner.start();

              if (!data.spec.exports || data.spec.exports.length === 0) {
                specSpinner.warn?.('No exports found in file');
              } else {
                specSpinner.succeed();
              }

              const outputPath = path.resolve(process.cwd(), options.output);
              fs.writeFileSync(outputPath, JSON.stringify(data.spec, null, 2));
              log(chalk.green(`✓ Saved to ${path.relative(process.cwd(), outputPath)}`));

              log('\nSummary:');
              const exportCount = data.spec.exports?.length || 0;
              const typeCount = data.spec.types?.length || 0;
              const filesAnalyzed = data.metadata.filesAnalyzed || 1;

              if (followItems.includes('imports') && filesAnalyzed > 1) {
                log(`- ${filesAnalyzed} files analyzed`);
              }

              if (exportCount > 0) {
                const functionExports = data.spec.exports.filter((exp) => exp.kind === 'function').length;
                const classExports = data.spec.exports.filter((exp) => exp.kind === 'class').length;
                const variableExports = data.spec.exports.filter((exp) => exp.kind === 'variable').length;
                const otherExports = exportCount - functionExports - classExports - variableExports;

                log(
                  `- ${exportCount} export${exportCount > 1 ? 's' : ''} found${filesAnalyzed > 1 ? ' (from root file)' : ''}`,
                );
                if (functionExports > 0) log(chalk.gray(`  - ${functionExports} function${functionExports > 1 ? 's' : ''}`));
                if (classExports > 0) log(chalk.gray(`  - ${classExports} class${classExports > 1 ? 'es' : ''}`));
                if (variableExports > 0) log(chalk.gray(`  - ${variableExports} variable${variableExports > 1 ? 's' : ''}`));
                if (otherExports > 0) log(chalk.gray(`  - ${otherExports} other`));
              } else {
                log(chalk.gray('- No exports found'));
              }

              log(
                `- ${typeCount} type${typeCount !== 1 ? 's' : ''} collected${filesAnalyzed > 1 ? ` (from all ${filesAnalyzed} files)` : ''}`,
              );
              log(chalk.gray(`- Analysis completed in ${data.metadata.duration}ms`));

              if (showItems.includes('summary') && (exportCount > 0 || typeCount > 0)) {
                log('');

                if (exportCount > 0) {
                  log(`${chalk.bold('Exports')} (${exportCount}):`);

                  const exportsByKind: Record<string, RemoteAnalysisResponse['spec']['exports']> = {};
                  for (const exp of data.spec.exports ?? []) {
                    const kind = exp.kind || 'other';
                    if (!exportsByKind[kind]) exportsByKind[kind] = [];
                    exportsByKind[kind]?.push(exp);
                  }

                  const kinds = Object.keys(exportsByKind);
                  kinds.forEach((kind, kindIndex) => {
                    const isLastKind = kindIndex === kinds.length - 1;
                    const kindLabel = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}s`;
                    log(`${isLastKind ? '└──' : '├──'} ${chalk.cyan(kindLabel)}`);

                    exportsByKind[kind]?.forEach((exp, index) => {
                      const isLast = index === (exportsByKind[kind]?.length ?? 0) - 1;
                      const prefix = isLastKind ? '    ' : '│   ';
                      log(`${prefix}${isLast ? '└──' : '├──'} ${exp.name ?? 'unknown'}`);
                    });
                  });
                }

                if (typeCount > 0) {
                  log('');
                  log(`${chalk.bold('Types')} (${typeCount}):`);

                  const typesByKind: Record<string, unknown[]> = {};
                  for (const type of data.spec.types ?? []) {
                    const kind = (type as { kind?: string }).kind || 'other';
                    if (!typesByKind[kind]) typesByKind[kind] = [];
                    typesByKind[kind].push(type);
                  }

                  const kinds = Object.keys(typesByKind);
                  kinds.forEach((kind, kindIndex) => {
                    const isLastKind = kindIndex === kinds.length - 1;
                    const kindLabel =
                      kind === 'interface'
                        ? 'Interfaces'
                        : kind === 'enum'
                          ? 'Enums'
                          : kind === 'type'
                            ? 'Type Aliases'
                            : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}s`;
                    log(`${isLastKind ? '└──' : '├──'} ${chalk.green(kindLabel)}`);

                    typesByKind[kind].forEach((type, index) => {
                      const isLast = index === typesByKind[kind].length - 1;
                      const prefix = isLastKind ? '    ' : '│   ';
                      log(`${prefix}${isLast ? '└──' : '├──'} ${(type as { name?: string }).name ?? 'unknown'}`);
                    });
                  });
                }
              }
            } else {
              warn(chalk.yellow('⚠️  No OpenPkg spec generated'));
              log(chalk.gray('File content:'));
              log(data.content ?? '');
            }
          }

          if (showItems.includes('debug')) {
            log(chalk.gray('\nDebug info:'));
            log(chalk.gray(`Files analyzed: ${data.metadata.filesAnalyzed}`));
            log(chalk.gray(`Duration: ${data.metadata.duration}ms`));
            log(chalk.gray(`Cached: ${data.metadata.cached}`));
            if (data.spec) {
              log(chalk.gray(`Spec version: ${data.spec.openpkg}`));
            }
            if (followItems.includes('imports') && data.metadata.dependencyGraph) {
              log(chalk.gray('\nDependency resolution:'));
              log(chalk.gray(JSON.stringify(data.metadata.dependencyGraph, null, 2)));
            }
            log('');
          }
        } catch (requestError) {
          fetchSpinner.fail('Failed to analyze remote source');

          if (requestError instanceof RemoteAnalysisError) {
            if (options.debug && requestError.details) {
              error(chalk.gray('\nDebug info:'));
              error(chalk.gray(JSON.stringify(requestError.details, null, 2)));
            }

            switch (requestError.code) {
              case 'FILE_NOT_FOUND':
                error(chalk.red('Error: File not found at the specified URL'));
                break;
              case 'INVALID_URL':
                error(chalk.red('Error: Invalid GitHub URL format'));
                break;
              case 'TIMEOUT':
                error(chalk.red('Error: Request timed out'));
                break;
              case 'NETWORK_ERROR':
                error(chalk.red('Error: Network error occurred'));
                break;
              default:
                error(chalk.red(requestError.message));
                break;
            }

            if (requestError.status === 0) {
              error(chalk.gray('Make sure your network connection is available.'));
            }
          } else {
            if (options.debug) {
              error(chalk.gray('\nDebug info:'));
              error(requestError);
            }
            error(chalk.red('Error: Could not analyze remote source'));
          }

          process.exit(1);
        }
      } catch (commandError) {
        error(chalk.red('Error:'), commandError instanceof Error ? commandError.message : commandError);
        process.exit(1);
      }
    });
}
