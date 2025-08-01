#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { OpenPkg } from '@openpkg/sdk';
import { findEntryPoint, findPackageInMonorepo } from './utils/package-utils';
import { detectBuildStatus, shouldWarnAboutBuild, formatBuildWarning } from './utils/build-detection';

const program = new Command();

program
  .name('openpkg')
  .description('Generate OpenPkg specification for TypeScript packages')
  .version('1.0.0');

// Generate command
program
  .command('generate [entry]')
  .description('Generate OpenPkg specification')
  .option('-o, --output <file>', 'Output file', 'openpkg.json')
  .option('-p, --package <name>', 'Target package name (for monorepos)')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .option('--skip-build-check', 'Skip build status warnings')
  .option('-y, --yes', 'Skip all prompts and use defaults')
  .action(async (entry, options) => {
    try {
      let targetDir = options.cwd;
      let entryFile = entry;

      // Handle monorepo package targeting
      if (options.package) {
        const packageDir = await findPackageInMonorepo(options.cwd, options.package);
        if (!packageDir) {
          throw new Error(`Package "${options.package}" not found in monorepo`);
        }
        targetDir = packageDir;
        console.log(chalk.gray(`Found package at ${path.relative(options.cwd, packageDir)}`));
      }

      // Auto-detect entry point if not provided
      if (!entryFile) {
        entryFile = await findEntryPoint(targetDir, true); // Always prefer source
        console.log(chalk.gray(`Auto-detected entry point: ${path.relative(targetDir, entryFile)}`));
      } else {
        // Resolve entry file relative to target directory
        entryFile = path.resolve(targetDir, entryFile);
      }

      // Check build status unless skipped
      if (!options.skipBuildCheck) {
        const buildStatus = detectBuildStatus(targetDir);
        
        if (shouldWarnAboutBuild(buildStatus)) {
          console.warn(chalk.yellow(formatBuildWarning(buildStatus)));
          
          // Ask user if they want to continue (unless -y flag is used)
          if (!options.yes) {
            const shouldContinue = await confirm({
              message: 'Do you want to continue anyway?',
              default: true
            });
            
            if (!shouldContinue) {
              console.log(chalk.gray('\nBuild your package first, then run openpkg generate again.'));
              process.exit(0);
            }
          }
        }
      }

      const spinner = ora('Generating OpenPkg spec...').start();
      
      let spec;
      try {
        const openpkg = new OpenPkg();
        spec = await openpkg.analyzeFile(entryFile);
        spinner.succeed('Generated OpenPkg spec');
      } catch (error) {
        spinner.fail('Failed to generate spec');
        throw error;
      }
      
      // Determine output path
      const outputPath = path.resolve(targetDir, options.output);
      fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
      
      console.log(chalk.green(`✓ Generated ${path.relative(process.cwd(), outputPath)}`));
      console.log(chalk.gray(`  ${spec.exports.length} exports`));
      console.log(chalk.gray(`  ${spec.types?.length || 0} types`));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze <url>')
  .description('Analyze TypeScript code from a URL (Studio feature)')
  .option('-o, --output <file>', 'Output file for OpenPkg spec', 'openpkg.json')
  .option('--show <items>', 'What to display: spec (default), imports, summary, debug (comma-separated)', 'spec')
  .option('--follow <items>', 'What to follow: imports (comma-separated)')
  .option('--max-depth <depth>', 'Maximum depth for import resolution', '5')
  .action(async (url, options) => {
    try {
      // Parse comma-separated values
      const showItems = options.show.split(',').map((s: string) => s.trim());
      const followItems = options.follow ? options.follow.split(',').map((s: string) => s.trim()) : [];
      
      // Validate show items
      const validShowItems = ['spec', 'imports', 'summary', 'debug'];
      const invalidShow = showItems.filter(item => !validShowItems.includes(item));
      if (invalidShow.length > 0) {
        console.error(chalk.red(`Invalid --show values: ${invalidShow.join(', ')}`));
        console.log(chalk.gray(`Valid options: ${validShowItems.join(', ')}`));
        process.exit(1);
      }
      
      // Validate follow items
      const validFollowItems = ['imports'];
      const invalidFollow = followItems.filter(item => !validFollowItems.includes(item));
      if (invalidFollow.length > 0) {
        console.error(chalk.red(`Invalid --follow values: ${invalidFollow.join(', ')}`));
        console.log(chalk.gray(`Valid options: ${validFollowItems.join(', ')}`));
        process.exit(1);
      }
      
      // Check if user is authenticated (for now, just warn)
      console.warn(chalk.yellow('⚠️  You are not authenticated with OpenPkg Studio. Some features may be limited.'));
      
      const spinner = ora(`Fetching ${path.basename(url)}...`).start();
      
      try {
        // Build request body with options
        const requestBody: any = { source: url };
        
        // Add options if specified
        if (followItems.includes('imports') || options.maxDepth !== '5') {
          requestBody.options = {};
          
          if (followItems.includes('imports')) {
            requestBody.options.followImports = true;
          }
          
          if (options.maxDepth !== '5') {
            requestBody.options.maxDepth = parseInt(options.maxDepth, 10);
          }
        }
        
        // Call Studio API
        const response = await fetch('http://localhost:3000/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          spinner.fail('Failed to analyze');
          
          if (options.debug) {
            console.error(chalk.gray('\nDebug info:'));
            console.error(chalk.gray(`Status: ${response.status}`));
            console.error(chalk.gray(`Response: ${JSON.stringify(data, null, 2)}`));
          }
          
          // Handle specific error codes
          if (data.error) {
            switch (data.error.code) {
              case 'FILE_NOT_FOUND':
                console.error(chalk.red('Error: File not found at the specified URL'));
                break;
              case 'INVALID_URL':
                console.error(chalk.red('Error: Invalid GitHub URL format'));
                break;
              case 'TIMEOUT':
                console.error(chalk.red('Error: Request timed out'));
                break;
              case 'NETWORK_ERROR':
                console.error(chalk.red('Error: Network error occurred'));
                break;
              default:
                console.error(chalk.red(`Error: ${data.error.message}`));
            }
          } else {
            console.error(chalk.red('Error: Unknown error occurred'));
          }
          
          process.exit(1);
        }
        
        spinner.succeed(`Fetched ${path.basename(url)}`);
        
        // Show dependency graph if imports were followed
        if (followItems.includes('imports') && data.metadata?.dependencyGraph) {
          const graph = data.metadata.dependencyGraph;
          console.log();
          console.log(chalk.bold('Dependency Graph:'));
          console.log(chalk.gray(`├── Total files: ${graph.totalFiles}`));
          console.log(chalk.gray(`├── Analyzed: ${graph.analyzedFiles}`));
          if (graph.errorFiles > 0) {
            console.log(chalk.yellow(`├── Errors: ${graph.errorFiles}`));
          }
          console.log(chalk.gray(`├── Total imports: ${graph.totalImports}`));
          console.log(chalk.gray(`└── Max depth reached: ${graph.maxDepth}`));
          
          // Provide feedback on max depth setting
          const specifiedDepth = parseInt(options.maxDepth, 10);
          if (graph.actualMaxDepth !== undefined && graph.actualMaxDepth < specifiedDepth) {
            // Only show message when we didn't use the full specified depth
            console.log();
            console.log(chalk.blue(`ℹ  Analyzed imports up to depth ${graph.actualMaxDepth} (max specified: ${specifiedDepth})`));
            console.log(chalk.gray(`   No imports found beyond depth ${graph.actualMaxDepth}`));
          }
          // If actualMaxDepth equals specifiedDepth, we used the full depth - no message needed
          
          // Show fetched files if showing summary
          if (showItems.includes('summary') && data.files) {
            console.log();
            console.log(chalk.bold('Files analyzed:'));
            const fileUrls = Object.keys(data.files);
            fileUrls.forEach((fileUrl, index) => {
              const isLast = index === fileUrls.length - 1;
              const fileName = path.basename(fileUrl);
              console.log(`${isLast ? '└──' : '├──'} ${fileName}`);
            });
          }
          console.log();
        }
        
        // Handle imports display
        if (showItems.includes('imports')) {
          // Check for parse errors first
          if (data.parseErrors && data.parseErrors.length > 0) {
            console.warn(chalk.yellow('\n⚠️  Parse errors detected:\n'));
            data.parseErrors.forEach((error: any) => {
              if (error.line && error.column) {
                console.warn(chalk.yellow(`  Line ${error.line}, Column ${error.column}: ${error.message}`));
              } else if (error.line) {
                console.warn(chalk.yellow(`  Line ${error.line}: ${error.message}`));
              } else {
                console.warn(chalk.yellow(`  ${error.message}`));
              }
            });
            console.log();
          }
          
          // Display imports
          if (data.imports && data.imports.length > 0) {
            spinner.succeed(`Parsing TypeScript...`);
            spinner.succeed(`Found ${data.imports.length} imports`);
            console.log();
            
            // Group imports by type
            const relativeImports = data.imports.filter((imp: any) => imp.type === 'relative');
            const packageImports = data.imports.filter((imp: any) => imp.type === 'package');
            const absoluteImports = data.imports.filter((imp: any) => imp.type === 'absolute');
            
            console.log(chalk.bold('Imports:'));
            
            // Display relative imports
            if (relativeImports.length > 0) {
              console.log(`├── ${chalk.cyan('Relative')} (${relativeImports.length})`);
              relativeImports.forEach((imp: any, index: number) => {
                const isLast = index === relativeImports.length - 1 && packageImports.length === 0 && absoluteImports.length === 0;
                const prefix = isLast ? '    └──' : '│   ├──';
                let importInfo = imp.path;
                
                if (imp.isTypeOnly) {
                  importInfo += chalk.gray(' (type-only)');
                }
                
                const importCount = (imp.importedNames?.length || 0) + 
                                  (imp.defaultImport ? 1 : 0) + 
                                  (imp.namespaceImport ? 1 : 0);
                
                if (importCount > 0) {
                  importInfo += chalk.gray(` [${importCount} import${importCount > 1 ? 's' : ''}]`);
                }
                
                console.log(`${prefix} ${importInfo}`);
              });
            }
            
            // Display package imports
            if (packageImports.length > 0) {
              const hasAbsolute = absoluteImports.length > 0;
              console.log(`${hasAbsolute ? '├──' : '└──'} ${chalk.green('Package')} (${packageImports.length})`);
              packageImports.forEach((imp: any, index: number) => {
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
                
                console.log(`${prefix} ${importInfo}`);
              });
            }
            
            // Display absolute imports (rare)
            if (absoluteImports.length > 0) {
              console.log(`└── ${chalk.yellow('Absolute')} (${absoluteImports.length})`);
              absoluteImports.forEach((imp: any, index: number) => {
                const isLast = index === absoluteImports.length - 1;
                const prefix = isLast ? '    └──' : '    ├──';
                console.log(`${prefix} ${imp.path}`);
              });
            }
            
            // Show summary message if there are parse errors
            if (data.parseErrors && data.parseErrors.length > 0) {
              console.log(chalk.gray('\nImports found before errors'));
            }
          } else {
            console.log(chalk.gray('No imports found'));
          }
        }
        
        // Handle spec display and saving
        if (showItems.includes('spec')) {
          // Generate and save OpenPkg spec
          if (data.spec) {
            const parseSpinner = ora('Parsing TypeScript...').start();
            parseSpinner.succeed();
            
            const specSpinner = ora('Generating OpenPkg spec...').start();
            
            // Handle spec generation errors
            if (!data.spec.exports || data.spec.exports.length === 0) {
              specSpinner.warn('No exports found in file');
            } else {
              specSpinner.succeed();
            }
            
            // Save spec to file
            const outputPath = path.resolve(process.cwd(), options.output);
            fs.writeFileSync(outputPath, JSON.stringify(data.spec, null, 2));
            console.log(chalk.green(`✓ Saved to ${path.relative(process.cwd(), outputPath)}`));
            
            // Show summary
            console.log('\nSummary:');
            const exportCount = data.spec.exports?.length || 0;
            const typeCount = data.spec.types?.length || 0;
            const filesAnalyzed = data.metadata.filesAnalyzed || 1;
            
            // Show file count if multiple files were analyzed
            if (followItems.includes('imports') && filesAnalyzed > 1) {
              console.log(`- ${filesAnalyzed} files analyzed`);
            }
            
            if (exportCount > 0) {
              // Count exports by kind
              const functionExports = data.spec.exports.filter((e: any) => e.kind === 'function').length;
              const classExports = data.spec.exports.filter((e: any) => e.kind === 'class').length;
              const variableExports = data.spec.exports.filter((e: any) => e.kind === 'variable').length;
              const otherExports = exportCount - functionExports - classExports - variableExports;
              
              console.log(`- ${exportCount} export${exportCount > 1 ? 's' : ''} found${filesAnalyzed > 1 ? ' (from root file)' : ''}`);
              if (functionExports > 0) console.log(chalk.gray(`  - ${functionExports} function${functionExports > 1 ? 's' : ''}`));
              if (classExports > 0) console.log(chalk.gray(`  - ${classExports} class${classExports > 1 ? 'es' : ''}`));
              if (variableExports > 0) console.log(chalk.gray(`  - ${variableExports} variable${variableExports > 1 ? 's' : ''}`));
              if (otherExports > 0) console.log(chalk.gray(`  - ${otherExports} other`));
            } else {
              console.log(chalk.gray('- No exports found'));
            }
            
            console.log(`- ${typeCount} type${typeCount !== 1 ? 's' : ''} collected${filesAnalyzed > 1 ? ` (from all ${filesAnalyzed} files)` : ''}`);
            console.log(chalk.gray(`- Analysis completed in ${data.metadata.duration}ms`));
            
            // Show detailed summary if requested
            if (showItems.includes('summary') && (exportCount > 0 || typeCount > 0)) {
              console.log();
              
              if (exportCount > 0) {
                console.log(chalk.bold('Exports') + ` (${exportCount}):`);
                
                // Group exports by kind
                const exportsByKind: Record<string, any[]> = {};
                data.spec.exports.forEach((exp: any) => {
                  const kind = exp.kind || 'other';
                  if (!exportsByKind[kind]) exportsByKind[kind] = [];
                  exportsByKind[kind].push(exp);
                });
                
                const kinds = Object.keys(exportsByKind);
                kinds.forEach((kind, kindIndex) => {
                  const isLastKind = kindIndex === kinds.length - 1;
                  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1) + 's';
                  console.log(`${isLastKind ? '└──' : '├──'} ${chalk.cyan(kindLabel)}`);
                  
                  exportsByKind[kind].forEach((exp: any, index: number) => {
                    const isLast = index === exportsByKind[kind].length - 1;
                    const prefix = isLastKind ? '    ' : '│   ';
                    console.log(`${prefix}${isLast ? '└──' : '├──'} ${exp.name}`);
                  });
                });
              }
              
              if (typeCount > 0) {
                console.log();
                console.log(chalk.bold('Types') + ` (${typeCount}):`);
                
                // Group types by kind
                const typesByKind: Record<string, any[]> = {};
                data.spec.types.forEach((type: any) => {
                  const kind = type.kind || 'other';
                  if (!typesByKind[kind]) typesByKind[kind] = [];
                  typesByKind[kind].push(type);
                });
                
                const kinds = Object.keys(typesByKind);
                kinds.forEach((kind, kindIndex) => {
                  const isLastKind = kindIndex === kinds.length - 1;
                  const kindLabel = kind === 'interface' ? 'Interfaces' : 
                                   kind === 'enum' ? 'Enums' :
                                   kind === 'type' ? 'Type Aliases' :
                                   kind.charAt(0).toUpperCase() + kind.slice(1) + 's';
                  console.log(`${isLastKind ? '└──' : '├──'} ${chalk.green(kindLabel)}`);
                  
                  typesByKind[kind].forEach((type: any, index: number) => {
                    const isLast = index === typesByKind[kind].length - 1;
                    const prefix = isLastKind ? '    ' : '│   ';
                    console.log(`${prefix}${isLast ? '└──' : '├──'} ${type.name}`);
                  });
                });
              }
            }
          } else {
            // No spec returned (shouldn't happen with Phase 1.3)
            console.warn(chalk.yellow('⚠️  No OpenPkg spec generated'));
            console.log(chalk.gray('File content:'));
            console.log(data.content);
          }
        }
        
        if (showItems.includes('debug')) {
          console.log(chalk.gray('\nDebug info:'));
          console.log(chalk.gray(`Files analyzed: ${data.metadata.filesAnalyzed}`));
          console.log(chalk.gray(`Duration: ${data.metadata.duration}ms`));
          console.log(chalk.gray(`Cached: ${data.metadata.cached}`));
          if (data.spec) {
            console.log(chalk.gray(`Spec version: ${data.spec.openpkg}`));
          }
          if (followItems.includes('imports') && data.metadata.dependencyGraph) {
            console.log(chalk.gray('\nDependency resolution:'));
            console.log(chalk.gray(JSON.stringify(data.metadata.dependencyGraph, null, 2)));
          }
          console.log();
        }
        
      } catch (error) {
        spinner.fail('Failed to connect to OpenPkg Studio');
        
        if (options.debug) {
          console.error(chalk.gray('\nDebug info:'));
          console.error(error);
        }
        
        console.error(chalk.red('Error: Could not connect to OpenPkg Studio API'));
        console.error(chalk.gray('Make sure the Studio server is running on http://localhost:3000'));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Make generate the default command if no subcommand is provided
program
  .command('*', { hidden: true })
  .action(() => {
    program.outputHelp();
  });

program.parse();