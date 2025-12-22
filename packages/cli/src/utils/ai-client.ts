/**
 * AI client with hosted API and BYOK fallback
 *
 * Flow:
 * 1. If DOCCOV_API_KEY set, try hosted API first
 * 2. If quota exceeded or no API key, fall back to local BYOK
 * 3. If no BYOK keys set, prompt user to configure
 */

import type { EnrichedExport, JSDocPatch } from '@doccov/sdk';
import chalk from 'chalk';
import { batchGenerateJSDocs, type GenerationResult, isAIGenerationAvailable } from './ai-generate';

const API_BASE = process.env.DOCCOV_API_URL || 'https://api.doccov.com';

interface HostedGenerationResult {
  success: boolean;
  generated: number;
  failed: number;
  results: Array<{
    name: string;
    patch: JSDocPatch | null;
    error?: string;
  }>;
  quota: {
    remaining: number | 'unlimited';
    resetAt: string;
  };
}

interface QuotaResult {
  plan: string;
  used: number;
  limit: number | 'unlimited';
  remaining: number | 'unlimited';
  resetAt: string;
}

/**
 * Check if hosted API is available
 */
export function isHostedAPIAvailable(): boolean {
  return Boolean(process.env.DOCCOV_API_KEY);
}

/**
 * Get remaining AI quota from hosted API
 */
export async function getQuota(): Promise<QuotaResult | null> {
  const apiKey = process.env.DOCCOV_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(`${API_BASE}/v1/ai/quota`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return null;

    return (await response.json()) as QuotaResult;
  } catch {
    return null;
  }
}

/**
 * Generate JSDoc using hosted API
 */
async function generateViaHostedAPI(
  exports: EnrichedExport[],
  packageName?: string,
): Promise<HostedGenerationResult | { error: string; quotaExceeded?: boolean }> {
  const apiKey = process.env.DOCCOV_API_KEY;
  if (!apiKey) {
    return { error: 'No DOCCOV_API_KEY set' };
  }

  try {
    const response = await fetch(`${API_BASE}/v1/ai/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exports: exports.map((exp) => ({
          name: exp.name,
          kind: exp.kind,
          signature: buildSignature(exp),
          members: exp.members?.slice(0, 10).map((m) => ({
            name: m.name,
            type: typeof m.type === 'string' ? m.type : undefined,
          })),
        })),
        packageName,
      }),
    });

    if (response.status === 429) {
      const data = await response.json();
      return {
        error: data.error || 'Monthly AI limit reached',
        quotaExceeded: true,
      };
    }

    if (!response.ok) {
      const data = await response.json();
      return { error: data.error || 'API request failed' };
    }

    return (await response.json()) as HostedGenerationResult;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}

/**
 * Build signature string from export
 */
function buildSignature(exp: EnrichedExport): string {
  if (exp.signatures && exp.signatures.length > 0) {
    const sig = exp.signatures[0];
    const params = sig.parameters?.map((p) => `${p.name}: ${p.type ?? 'unknown'}`).join(', ') ?? '';
    const ret = sig.returnType ?? 'void';
    return `(${params}) => ${ret}`;
  }

  if (exp.type) {
    return typeof exp.type === 'string' ? exp.type : JSON.stringify(exp.type);
  }

  return exp.kind;
}

export interface AIClientOptions {
  maxConcurrent?: number;
  onProgress?: (completed: number, total: number, exportName: string) => void;
  log?: typeof console.log;
  packageName?: string;
}

export interface AIClientResult {
  results: GenerationResult[];
  source: 'hosted' | 'byok';
  quotaRemaining?: number | 'unlimited';
  quotaResetAt?: string;
}

/**
 * Generate JSDoc for exports using hosted API with BYOK fallback
 */
export async function generateWithFallback(
  exports: EnrichedExport[],
  options: AIClientOptions = {},
): Promise<AIClientResult> {
  const { log = console.log } = options;

  // Try hosted API first if available
  if (isHostedAPIAvailable()) {
    log(chalk.dim('Using DocCov hosted AI...'));

    const hostedResult = await generateViaHostedAPI(exports, options.packageName);

    if ('error' in hostedResult) {
      if (hostedResult.quotaExceeded) {
        log(chalk.yellow(`\n⚠ ${hostedResult.error}`));
        log(chalk.dim('Falling back to local API keys...'));

        // Fall back to BYOK
        if (isAIGenerationAvailable()) {
          return await generateViaBYOK(exports, options);
        }

        log(chalk.red('No local API keys configured.'));
        log(chalk.dim('Set OPENAI_API_KEY or ANTHROPIC_API_KEY for unlimited generation.'));
        return { results: [], source: 'byok' };
      }

      log(chalk.yellow(`\n⚠ Hosted API error: ${hostedResult.error}`));
      log(chalk.dim('Falling back to local API keys...'));
    } else {
      // Convert hosted result to GenerationResult format
      const results: GenerationResult[] = hostedResult.results.map((r) => ({
        exportName: r.name,
        patch: r.patch ?? {},
        generated: r.patch !== null,
      }));

      return {
        results,
        source: 'hosted',
        quotaRemaining: hostedResult.quota.remaining,
        quotaResetAt: hostedResult.quota.resetAt,
      };
    }
  }

  // No hosted API or error - try BYOK
  if (isAIGenerationAvailable()) {
    return await generateViaBYOK(exports, options);
  }

  // No AI available
  log(chalk.yellow('\n⚠ No AI configuration available.'));
  log(chalk.dim('Options:'));
  log(chalk.dim('  1. Set DOCCOV_API_KEY for hosted AI (included with Team/Pro plan)'));
  log(chalk.dim('  2. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for direct API access'));

  return { results: [], source: 'byok' };
}

/**
 * Generate JSDoc using local BYOK keys
 */
async function generateViaBYOK(
  exports: EnrichedExport[],
  options: AIClientOptions,
): Promise<AIClientResult> {
  const { log = console.log } = options;

  log(chalk.dim('Using local API keys (BYOK)...'));

  const results = await batchGenerateJSDocs(exports, {
    maxConcurrent: options.maxConcurrent ?? 3,
    onProgress: options.onProgress,
  });

  return {
    results,
    source: 'byok',
  };
}
