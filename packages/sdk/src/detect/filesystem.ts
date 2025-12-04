/**
 * FileSystem implementations for project detection.
 *
 * - NodeFileSystem: Uses Node.js fs module (for CLI)
 * - SandboxFileSystem: Uses Vercel Sandbox commands (for API)
 */

import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { Writable } from 'node:stream';
import type { Sandbox } from '@vercel/sandbox';
import type { FileSystem } from './types';

/**
 * Node.js filesystem implementation for CLI usage.
 * Wraps Node.js fs module with a base path.
 */
export class NodeFileSystem implements FileSystem {
  constructor(private basePath: string) {}

  private resolve(relativePath: string): string {
    return nodePath.join(this.basePath, relativePath);
  }

  async exists(relativePath: string): Promise<boolean> {
    return fs.existsSync(this.resolve(relativePath));
  }

  async readFile(relativePath: string): Promise<string> {
    return fs.readFileSync(this.resolve(relativePath), 'utf-8');
  }

  async readDir(relativePath: string): Promise<string[]> {
    return fs.readdirSync(this.resolve(relativePath));
  }

  async isDirectory(relativePath: string): Promise<boolean> {
    const fullPath = this.resolve(relativePath);
    if (!fs.existsSync(fullPath)) return false;
    return fs.statSync(fullPath).isDirectory();
  }
}

/**
 * Helper to capture stream output from sandbox commands.
 */
function createCaptureStream(): { stream: Writable; getOutput: () => string } {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return { stream, getOutput: () => output };
}

/**
 * Error thrown when a file cannot be read in the sandbox.
 */
export class FileNotFoundError extends Error {
  constructor(
    public readonly path: string,
    message?: string,
  ) {
    super(message ?? `File not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Vercel Sandbox filesystem implementation for API usage.
 * Uses sandbox.runCommand() with shell commands.
 */
export class SandboxFileSystem implements FileSystem {
  constructor(private sandbox: Sandbox) {}

  async exists(path: string): Promise<boolean> {
    const result = await this.sandbox.runCommand({
      cmd: 'test',
      args: ['-e', path],
    });
    return result.exitCode === 0;
  }

  async readFile(path: string): Promise<string> {
    // Check if file exists first to throw typed error
    const exists = await this.exists(path);
    if (!exists) {
      throw new FileNotFoundError(path);
    }

    const capture = createCaptureStream();
    const result = await this.sandbox.runCommand({
      cmd: 'cat',
      args: [path],
      stdout: capture.stream,
    });

    if (result.exitCode !== 0) {
      throw new FileNotFoundError(path, `Failed to read file: ${path}`);
    }

    return capture.getOutput();
  }

  async readDir(path: string): Promise<string[]> {
    const capture = createCaptureStream();
    const result = await this.sandbox.runCommand({
      cmd: 'ls',
      args: ['-1', path],
      stdout: capture.stream,
    });

    if (result.exitCode !== 0) {
      return [];
    }

    return capture.getOutput().split('\n').filter(Boolean);
  }

  async isDirectory(path: string): Promise<boolean> {
    const result = await this.sandbox.runCommand({
      cmd: 'test',
      args: ['-d', path],
    });
    return result.exitCode === 0;
  }
}
