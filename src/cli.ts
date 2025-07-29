// src/cli.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { generateBaseSpec } from './base-parser';
import { generateEnhancedSpec } from './base-parser-enhanced';
import { resolveSpec } from './ai-agent';
import { enhanceWithAI } from './ai-agent-enhanced';
import { validateOpenPkg } from './utils/validate'; // Reused
import { getCachedSpec, cacheSpec } from './utils/cache';
import { logger, LogLevel } from './utils/logger';
import fs from 'fs';

const program = new Command();
program
  .argument('[entry]', 'File path or package')
  .option('--function <names>', 'Functions to focus on')
  .option('--depth <number>', 'Resolution depth (0 for base spec)', '0')
  .option('--output <file>', 'Output file path', 'output.json')
  .option('--no-cache', 'Disable caching')
  .option('--use-legacy-parser', 'Use legacy ts-morph parser instead of TypeScript Compiler API')
  .option('--include-resolved-types', 'Include resolved type information in output')
  .option('--include-type-hierarchy', 'Include type hierarchy information')
  .option('--max-depth <number>', 'Maximum depth for type resolution', '5')
  .option('--enhance-with-ai', 'Use AI to enhance documentation and examples')
  .option('--ai-examples', 'Generate code examples using AI')
  .option('--ai-descriptions', 'Enhance descriptions using AI')
  .option('-v, --verbose', 'Enable verbose output for debugging')
  .action(async (entry, options) => {
    try {
      // Configure logging
      if (options.verbose) {
        logger.setVerbose(true);
        logger.info('Verbose mode enabled');
      }

      const entryFile = entry || 'index.ts';
      const cacheKey = `${entryFile}_depth${options.depth}`;
      
      logger.debug(`Processing file: ${entryFile}`);
      logger.debug('Options:', options);
      
      // Check cache first
      if (options.cache) {
        logger.debug('Checking cache...');
        const cached = getCachedSpec(cacheKey);
        if (cached) {
          logger.info('Using cached spec');
          fs.writeFileSync(options.output, JSON.stringify(cached, null, 2));
          logger.info(`✓ Cached spec written to ${options.output}`);
          if (!options.verbose) {
            console.log(JSON.stringify(cached, null, 2));
          }
          return;
        }
        logger.debug('Cache miss, proceeding with generation');
      }
      
      let spec;
      
      // Use enhanced parser by default, legacy only if requested
      if (options.useLegacyParser) {
        console.log(chalk.yellow('Using legacy ts-morph parser'));
        spec = generateBaseSpec(entryFile); // Legacy ts-morph parse
      } else {
        // Enhanced TypeScript Compiler API parser is now default
        spec = generateEnhancedSpec(entryFile, {
          includeResolvedTypes: options.includeResolvedTypes,
          includeTypeHierarchy: options.includeTypeHierarchy,
          maxDepth: parseInt(options.maxDepth),
          useCompilerAPI: true
        });
      }
      
      // AI enhancement is now optional and complementary
      if (options.enhanceWithAi || options.aiExamples || options.aiDescriptions) {
        console.log(chalk.blue('Enhancing with AI...'));
        spec = await enhanceWithAI(spec, {
          generateExamples: options.aiExamples,
          enhanceDescriptions: options.aiDescriptions,
          suggestBestPractices: false,
          analyzeUsagePatterns: false
        });
      }
      
      // Legacy depth option for backward compatibility
      if (parseInt(options.depth) > 0 && !options.enhanceWithAi) {
        console.log(chalk.yellow('Note: --depth is deprecated. Use --enhance-with-ai for AI features'));
        spec = await resolveSpec(spec, parseInt(options.depth));
      }
      
      const validatedSpec = validateOpenPkg(spec);
      
      // Cache the result
      if (options.cache) {
        cacheSpec(cacheKey, validatedSpec);
      }
      
      // Write to output file
      fs.writeFileSync(options.output, JSON.stringify(validatedSpec, null, 2));
      logger.info(`✓ Generated spec written to ${options.output}`);
      
      // Show output statistics in verbose mode
      if (options.verbose) {
        const stats = {
          exports: validatedSpec.exports.length,
          types: validatedSpec.types.length,
          outputSize: JSON.stringify(validatedSpec).length
        };
        logger.debug('Output statistics:', stats);
      } else {
        // Also log to console for normal mode
        console.log(JSON.stringify(validatedSpec, null, 2));
      }
    } catch (error) {
      logger.error('Generation failed:', error as Error);
      if (!options.verbose) {
        console.error(chalk.red('Error:', (error as Error).message));
        console.error(chalk.gray('Run with --verbose for more details'));
      }
      process.exit(1);
    }
  });
program.parse();