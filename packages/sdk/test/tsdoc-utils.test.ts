import { describe, expect, it } from 'bun:test';
import { parseJSDocText } from '../src/utils/tsdoc-utils';

describe('parseJSDocText', () => {
  it('captures links, see tags, and examples', () => {
    const comment = `
/**
 * Creates a new middleware from an API key.
 * @example
 * example usage with {@link createFetchFn}
 * @see {@link createFetchFn}, {@link STACKS_TESTNET}
 */
`;

    const parsed = parseJSDocText(comment);

    expect(parsed.description).toContain('Creates a new middleware');
    expect(parsed.examples?.[0]).toContain('example usage');

    expect(parsed.tags).toBeDefined();
    const tags = parsed.tags ?? [];
    const hasTag = (name: string, text: string) => tags.some((tag) => tag.name === name && tag.text === text);

    expect(hasTag('link', 'createFetchFn')).toBe(true);
    expect(hasTag('see', 'createFetchFn')).toBe(true);
    expect(hasTag('see', 'STACKS_TESTNET')).toBe(true);
  });
});
