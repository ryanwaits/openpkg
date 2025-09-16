import { describe, expect, it } from 'bun:test';
import { InMemoryRemoteCache } from '../src/remote/cache/cache';
import { analyzeRemote, RemoteAnalysisError } from '../src/remote';

describe('analyzeRemote', () => {
  it('analyzes inline code when type is code', async () => {
    const result = await analyzeRemote({
      source: 'export const value = 42;',
      type: 'code',
    });

    expect(result.spec?.exports).toBeTruthy();
    expect(result.metadata.filesAnalyzed).toBe(1);
    expect(result.imports.length).toBe(0);
  });

  it('throws error for invalid GitHub URL', async () => {
    await expect(
      analyzeRemote({
        source: 'https://example.com/file.ts',
        type: 'url',
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'INVALID_URL' }));
  });

  it('uses cache for repeated remote fetches', async () => {
    const cache = new InMemoryRemoteCache();
    let fetchCalls = 0;

    await analyzeRemote(
      {
        source: 'https://github.com/foo/bar/blob/main/index.ts',
        type: 'url',
      },
      {
        fetchContent: async () => {
          fetchCalls += 1;
          return 'export const cached = 1;';
        },
        cache,
      },
    );

    await analyzeRemote(
      {
        source: 'https://github.com/foo/bar/blob/main/index.ts',
        type: 'url',
      },
      {
        fetchContent: async () => {
          fetchCalls += 1;
          return 'export const cached = 1;';
        },
        cache,
      },
    );

    expect(fetchCalls).toBe(1);
  });
});
