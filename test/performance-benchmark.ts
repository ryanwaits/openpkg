import { generateBaseSpec } from '../src/base-parser';
import { generateEnhancedSpec } from '../src/base-parser-enhanced';
import * as fs from 'fs';
import * as path from 'path';

const testDir = path.join(__dirname, 'temp-benchmark');

function ensureTestDir() {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
}

function cleanupTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
}

interface BenchmarkResult {
  name: string;
  parser: string;
  fileSize: number;
  executionTime: number;
  memoryUsed: number;
  outputSize: number;
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function formatTime(ms: number): string {
  return ms.toFixed(2) + ' ms';
}

async function runBenchmark(
  name: string,
  filePath: string,
  parser: 'legacy' | 'enhanced',
  options: any = {}
): Promise<BenchmarkResult> {
  const fileStats = fs.statSync(filePath);
  const startTime = performance.now();
  const startMemory = process.memoryUsage();

  let spec;
  if (parser === 'legacy') {
    spec = generateBaseSpec(filePath);
  } else {
    spec = generateEnhancedSpec(filePath, options);
  }

  const endTime = performance.now();
  const endMemory = process.memoryUsage();

  const outputJson = JSON.stringify(spec);

  return {
    name,
    parser,
    fileSize: fileStats.size,
    executionTime: endTime - startTime,
    memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
    outputSize: outputJson.length
  };
}

async function main() {
  console.log('OpenPkg Performance Benchmark\n');
  console.log('Setting up test files...\n');

  ensureTestDir();

  // Test Case 1: Simple file
  const simpleFile = path.join(testDir, 'simple.ts');
  fs.writeFileSync(simpleFile, `
    export interface User {
      id: string;
      name: string;
    }
    
    export function getUser(id: string): User {
      return { id, name: 'Test' };
    }
  `);

  // Test Case 2: Medium complexity with generics
  const mediumFile = path.join(testDir, 'medium.ts');
  fs.writeFileSync(mediumFile, `
    export interface BaseEntity {
      id: string;
      createdAt: Date;
      updatedAt: Date;
    }
    
    export interface User extends BaseEntity {
      name: string;
      email: string;
      profile: UserProfile;
    }
    
    export interface UserProfile {
      bio: string;
      avatar: string;
      preferences: Record<string, any>;
    }
    
    export type PartialUser = Partial<User>;
    export type ReadonlyUser = Readonly<User>;
    export type UserWithoutDates = Omit<User, 'createdAt' | 'updatedAt'>;
    
    export class UserService {
      private users = new Map<string, User>();
      
      async findUser(id: string): Promise<User | null> {
        return this.users.get(id) || null;
      }
      
      async createUser(data: Partial<User>): Promise<User> {
        const user: User = {
          id: Math.random().toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
          name: data.name || '',
          email: data.email || '',
          profile: data.profile || { bio: '', avatar: '', preferences: {} }
        };
        this.users.set(user.id, user);
        return user;
      }
    }
  `);

  // Test Case 3: Large file with many exports
  const largeFile = path.join(testDir, 'large.ts');
  let largeContent = '';
  for (let i = 0; i < 50; i++) {
    largeContent += `
      export interface Entity${i} {
        id: string;
        name: string;
        value: number;
        metadata: Record<string, any>;
      }
      
      export function process${i}(entity: Entity${i}): Entity${i} {
        return { ...entity, value: entity.value * 2 };
      }
      
      export type Partial${i} = Partial<Entity${i}>;
      export type Readonly${i} = Readonly<Entity${i}>;
    `;
  }
  fs.writeFileSync(largeFile, largeContent);

  const results: BenchmarkResult[] = [];

  // Run benchmarks
  console.log('Running benchmarks...\n');

  // Simple file benchmarks
  results.push(await runBenchmark('Simple File', simpleFile, 'legacy'));
  results.push(await runBenchmark('Simple File', simpleFile, 'enhanced'));
  results.push(await runBenchmark('Simple File (with resolved types)', simpleFile, 'enhanced', {
    includeResolvedTypes: true
  }));

  // Medium file benchmarks
  results.push(await runBenchmark('Medium File', mediumFile, 'legacy'));
  results.push(await runBenchmark('Medium File', mediumFile, 'enhanced'));
  results.push(await runBenchmark('Medium File (with resolved types)', mediumFile, 'enhanced', {
    includeResolvedTypes: true,
    includeTypeHierarchy: true
  }));

  // Large file benchmarks
  results.push(await runBenchmark('Large File', largeFile, 'legacy'));
  results.push(await runBenchmark('Large File', largeFile, 'enhanced'));
  results.push(await runBenchmark('Large File (with resolved types)', largeFile, 'enhanced', {
    includeResolvedTypes: true,
    maxDepth: 3
  }));

  // Display results
  console.log('\nResults:\n');
  console.log('| Test Case | Parser | File Size | Execution Time | Memory Used | Output Size |');
  console.log('|-----------|--------|-----------|----------------|-------------|-------------|');
  
  for (const result of results) {
    console.log(
      `| ${result.name.padEnd(25)} | ${result.parser.padEnd(8)} | ${
        formatBytes(result.fileSize).padEnd(9)
      } | ${formatTime(result.executionTime).padEnd(14)} | ${
        formatBytes(result.memoryUsed).padEnd(11)
      } | ${formatBytes(result.outputSize).padEnd(11)} |`
    );
  }

  // Calculate improvements
  console.log('\n\nPerformance Comparison:\n');
  
  const simpleEnhanced = results.find(r => r.name === 'Simple File' && r.parser === 'enhanced')!;
  const simpleLegacy = results.find(r => r.name === 'Simple File' && r.parser === 'legacy')!;
  
  const mediumEnhanced = results.find(r => r.name === 'Medium File' && r.parser === 'enhanced')!;
  const mediumLegacy = results.find(r => r.name === 'Medium File' && r.parser === 'legacy')!;
  
  const largeEnhanced = results.find(r => r.name === 'Large File' && r.parser === 'enhanced')!;
  const largeLegacy = results.find(r => r.name === 'Large File' && r.parser === 'legacy')!;

  console.log('Execution Time Comparison (Enhanced vs Legacy):');
  console.log(`- Simple: ${((simpleEnhanced.executionTime / simpleLegacy.executionTime) * 100).toFixed(0)}% of legacy time`);
  console.log(`- Medium: ${((mediumEnhanced.executionTime / mediumLegacy.executionTime) * 100).toFixed(0)}% of legacy time`);
  console.log(`- Large: ${((largeEnhanced.executionTime / largeLegacy.executionTime) * 100).toFixed(0)}% of legacy time`);

  console.log('\nOutput Size Comparison (Enhanced vs Legacy):');
  console.log(`- Simple: ${((simpleEnhanced.outputSize / simpleLegacy.outputSize) * 100).toFixed(0)}% of legacy size`);
  console.log(`- Medium: ${((mediumEnhanced.outputSize / mediumLegacy.outputSize) * 100).toFixed(0)}% of legacy size`);
  console.log(`- Large: ${((largeEnhanced.outputSize / largeLegacy.outputSize) * 100).toFixed(0)}% of legacy size`);

  cleanupTestDir();
  console.log('\nBenchmark complete!');
}

main().catch(console.error);