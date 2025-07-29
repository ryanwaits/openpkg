// src/cli.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { generateBaseSpec } from './base-parser';
import { generateEnhancedSpec } from './base-parser-enhanced';
import { resolveSpec } from './ai-agent';
import { validateOpenPkg } from './utils/validate'; // Reused
import { getCachedSpec, cacheSpec } from './utils/cache';
import fs from 'fs';

const program = new Command();
program
  .argument('[entry]', 'File path or package')
  .option('--function <names>', 'Functions to focus on')
  .option('--depth <number>', 'Resolution depth (0 for base spec)', '0')
  .option('--output <file>', 'Output file path', 'output.json')
  .option('--no-cache', 'Disable caching')
  .option('--use-enhanced-parser', 'Use enhanced TypeScript Compiler API parser (experimental)')
  .option('--include-resolved-types', 'Include resolved type information in output')
  .option('--include-type-hierarchy', 'Include type hierarchy information')
  .option('--max-depth <number>', 'Maximum depth for type resolution', '5')
  .action(async (entry, options) => {
    try {
      const entryFile = entry || 'index.ts';
      const cacheKey = `${entryFile}_depth${options.depth}`;
      
      // Check cache first
      if (options.cache) {
        const cached = getCachedSpec(cacheKey);
        if (cached) {
          console.log(chalk.yellow('Using cached spec'));
          fs.writeFileSync(options.output, JSON.stringify(cached, null, 2));
          console.log(chalk.green(`✓ Cached spec written to ${options.output}`));
          console.log(JSON.stringify(cached, null, 2));
          return;
        }
      }
      
      let spec;
      
      // Use enhanced parser if flag is set
      if (options.useEnhancedParser) {
        spec = generateEnhancedSpec(entryFile, {
          includeResolvedTypes: options.includeResolvedTypes,
          includeTypeHierarchy: options.includeTypeHierarchy,
          maxDepth: parseInt(options.maxDepth),
          useCompilerAPI: true
        });
      } else {
        spec = generateBaseSpec(entryFile); // Base parse
      }
      
      // AI resolution if requested (works with both parsers)
      if (parseInt(options.depth) > 0) {
        spec = await resolveSpec(spec, parseInt(options.depth)); // AI resolution
      }
      
      const validatedSpec = validateOpenPkg(spec);
      
      // Cache the result
      if (options.cache) {
        cacheSpec(cacheKey, validatedSpec);
      }
      
      // Write to output file
      fs.writeFileSync(options.output, JSON.stringify(validatedSpec, null, 2));
      console.log(chalk.green(`✓ Generated spec written to ${options.output}`));
      
      // Also log to console for debugging
      console.log(JSON.stringify(validatedSpec, null, 2));
    } catch (error) {
      console.error(chalk.red('Error:', (error as Error).message));
      process.exit(1);
    }
  });
program.parse();