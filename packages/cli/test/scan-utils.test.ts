import { describe, expect, it } from 'bun:test';
import { parseGitHubUrl, buildCloneUrl, buildDisplayUrl } from '../src/utils/github-url';

describe('parseGitHubUrl', () => {
  describe('full URLs', () => {
    it('parses https://github.com/owner/repo', () => {
      const result = parseGitHubUrl('https://github.com/sindresorhus/is');
      expect(result).toEqual({
        owner: 'sindresorhus',
        repo: 'is',
        ref: 'main',
      });
    });

    it('parses URL with tree/branch', () => {
      const result = parseGitHubUrl('https://github.com/trpc/trpc/tree/next');
      expect(result).toEqual({
        owner: 'trpc',
        repo: 'trpc',
        ref: 'next',
      });
    });

    it('parses URL with tree/tag', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/v1.0.0');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        ref: 'v1.0.0',
      });
    });

    it('parses URL with .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        ref: 'main',
      });
    });

    it('handles refs with slashes', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/feature/new-thing');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        ref: 'feature/new-thing',
      });
    });
  });

  describe('shorthand formats', () => {
    it('parses owner/repo shorthand', () => {
      const result = parseGitHubUrl('sindresorhus/is');
      expect(result).toEqual({
        owner: 'sindresorhus',
        repo: 'is',
        ref: 'main',
      });
    });

    it('parses github.com/owner/repo', () => {
      const result = parseGitHubUrl('github.com/trpc/trpc');
      expect(result).toEqual({
        owner: 'trpc',
        repo: 'trpc',
        ref: 'main',
      });
    });
  });

  describe('custom default ref', () => {
    it('uses custom default ref', () => {
      const result = parseGitHubUrl('owner/repo', 'develop');
      expect(result.ref).toBe('develop');
    });

    it('URL ref overrides default', () => {
      const result = parseGitHubUrl('github.com/owner/repo/tree/v2', 'develop');
      expect(result.ref).toBe('v2');
    });
  });

  describe('error cases', () => {
    it('throws on empty string', () => {
      expect(() => parseGitHubUrl('')).toThrow('cannot be empty');
    });

    it('throws on single word', () => {
      expect(() => parseGitHubUrl('invalid')).toThrow('Invalid GitHub URL format');
    });
  });
});

describe('buildCloneUrl', () => {
  it('builds clone URL from parsed result', () => {
    const parsed = { owner: 'trpc', repo: 'trpc', ref: 'main' };
    expect(buildCloneUrl(parsed)).toBe('https://github.com/trpc/trpc.git');
  });
});

describe('buildDisplayUrl', () => {
  it('builds display URL from parsed result', () => {
    const parsed = { owner: 'sindresorhus', repo: 'is', ref: 'main' };
    expect(buildDisplayUrl(parsed)).toBe('github.com/sindresorhus/is');
  });
});

