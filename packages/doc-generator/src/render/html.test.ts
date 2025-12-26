import { describe, expect, test } from 'bun:test';
import type { OpenPkg } from '@openpkg-ts/spec';
import { toHTML } from './html';

const sampleSpec: OpenPkg = {
  openpkg: '0.4.0',
  meta: {
    ecosystem: 'js/ts',
    name: 'test-lib',
    version: '1.0.0',
    description: 'A test library',
  },
  exports: [
    {
      id: 'greet',
      name: 'greet',
      kind: 'function',
      description: 'Greet a user.',
      signatures: [
        {
          parameters: [
            { name: 'name', schema: { type: 'string' }, required: true, description: 'User name' },
          ],
          returns: { schema: { type: 'string' }, description: 'Greeting' },
        },
      ],
      examples: [{ code: 'greet("World")', language: 'ts' }],
    },
    {
      id: 'Logger',
      name: 'Logger',
      kind: 'class',
      description: 'Logger class.',
      deprecated: true,
      members: [
        { name: 'info', kind: 'method', signatures: [{ parameters: [] }] },
        { name: 'level', kind: 'property', schema: { type: 'string' } },
      ],
    },
    {
      id: 'LogLevel',
      name: 'LogLevel',
      kind: 'enum',
      members: [
        { name: 'DEBUG', description: 'Debug' },
        { name: 'INFO', description: 'Info' },
      ],
    },
  ],
};

describe('toHTML', () => {
  test('renders full spec as HTML document', () => {
    const html = toHTML(sampleSpec);

    expect(html).toMatchSnapshot();
  });

  test('renders single export', () => {
    const html = toHTML(sampleSpec, { export: 'greet' });

    expect(html).toMatchSnapshot();
  });

  test('renders without full document wrapper', () => {
    const html = toHTML(sampleSpec, { fullDocument: false });

    expect(html).not.toContain('<!DOCTYPE html>');
    expect(html).toContain('test-lib API Reference');
  });

  test('includes styles by default', () => {
    const html = toHTML(sampleSpec);

    expect(html).toContain('<style>');
    expect(html).toContain('--text:');
  });

  test('excludes styles when disabled', () => {
    const html = toHTML(sampleSpec, { includeStyles: false });

    expect(html).not.toContain('<style>');
  });

  test('includes custom CSS', () => {
    const html = toHTML(sampleSpec, { customCSS: '.custom { color: red; }' });

    expect(html).toContain('.custom { color: red; }');
  });

  test('includes custom head content', () => {
    const html = toHTML(sampleSpec, { headContent: '<link rel="icon" href="/favicon.ico">' });

    expect(html).toContain('<link rel="icon" href="/favicon.ico">');
  });

  test('uses custom title', () => {
    const html = toHTML(sampleSpec, { title: 'Custom Title' });

    expect(html).toContain('<title>Custom Title</title>');
  });

  test('throws for unknown export', () => {
    expect(() => toHTML(sampleSpec, { export: 'unknown' })).toThrow('Export not found');
  });

  test('escapes HTML in content', () => {
    const specWithHtml: OpenPkg = {
      ...sampleSpec,
      exports: [
        {
          id: 'test',
          name: 'test',
          kind: 'function',
          description: 'Returns <script>alert("xss")</script>',
        },
      ],
    };
    const html = toHTML(specWithHtml, { export: 'test' });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
