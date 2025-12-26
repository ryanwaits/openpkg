import type { OpenPkg, SpecExample, SpecExport, SpecMember, SpecSignature } from '@openpkg-ts/spec';
import {
  buildSignatureString,
  formatParameters,
  formatReturnType,
  formatSchema,
  getMethods,
  getProperties,
} from '../core/query';

export interface MarkdownOptions {
  /** Include frontmatter in output */
  frontmatter?: boolean;
  /** Sections to include */
  sections?: {
    signature?: boolean;
    description?: boolean;
    parameters?: boolean;
    returns?: boolean;
    examples?: boolean;
    members?: boolean;
    properties?: boolean;
    methods?: boolean;
  };
  /** Custom frontmatter fields */
  customFrontmatter?: Record<string, unknown>;
  /** Use code fences for signatures */
  codeSignatures?: boolean;
  /** Heading level offset (0 = starts at h1, 1 = starts at h2) */
  headingOffset?: number;
}

export interface ExportMarkdownOptions extends MarkdownOptions {
  /** Export to render */
  export?: string;
}

const defaultSections = {
  signature: true,
  description: true,
  parameters: true,
  returns: true,
  examples: true,
  members: true,
  properties: true,
  methods: true,
};

/**
 * Generate frontmatter YAML block.
 */
function generateFrontmatter(exp: SpecExport, custom?: Record<string, unknown>): string {
  const slug = exp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const meta: Record<string, unknown> = {
    title: exp.name,
    description: exp.description?.slice(0, 160) || `API reference for ${exp.name}`,
    slug,
    ...custom,
  };

  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'string') {
      // Escape quotes in strings
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    }
  }
  lines.push('---', '');

  return lines.join('\n');
}

/**
 * Render heading with offset.
 */
function heading(level: number, text: string, offset = 0): string {
  const actualLevel = Math.min(level + offset, 6);
  return `${'#'.repeat(actualLevel)} ${text}`;
}

/**
 * Render parameters section.
 */
function renderParameters(sig: SpecSignature | undefined, offset = 0): string {
  if (!sig?.parameters?.length) return '';

  const lines = [heading(2, 'Parameters', offset), ''];

  for (const param of sig.parameters) {
    const type = formatSchema(param.schema);
    const required = param.required !== false ? '' : '?';
    const rest = param.rest ? '...' : '';

    lines.push(`### \`${rest}${param.name}${required}\``);
    lines.push('');
    lines.push(`**Type:** \`${type}\``);
    if (param.description) {
      lines.push('');
      lines.push(param.description);
    }
    if (param.default !== undefined) {
      lines.push('');
      lines.push(`**Default:** \`${JSON.stringify(param.default)}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render returns section.
 */
function renderReturns(sig: SpecSignature | undefined, offset = 0): string {
  if (!sig?.returns) return '';

  const lines = [heading(2, 'Returns', offset), ''];
  const type = formatSchema(sig.returns.schema);

  lines.push(`**Type:** \`${type}\``);
  if (sig.returns.description) {
    lines.push('');
    lines.push(sig.returns.description);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Render examples section.
 */
function renderExamples(examples: (string | SpecExample)[] | undefined, offset = 0): string {
  if (!examples?.length) return '';

  const lines = [heading(2, 'Examples', offset), ''];

  for (const example of examples) {
    if (typeof example === 'string') {
      lines.push('```ts');
      lines.push(example);
      lines.push('```');
    } else {
      if (example.title) {
        lines.push(`### ${example.title}`);
        lines.push('');
      }
      if (example.description) {
        lines.push(example.description);
        lines.push('');
      }
      lines.push(`\`\`\`${example.language || 'ts'}`);
      lines.push(example.code);
      lines.push('```');
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render properties section.
 */
function renderProperties(members: SpecMember[] | undefined, offset = 0): string {
  const props = getProperties(members);
  if (!props.length) return '';

  const lines = [heading(2, 'Properties', offset), ''];

  for (const prop of props) {
    const type = formatSchema(prop.schema);
    lines.push(`### \`${prop.name}\``);
    lines.push('');
    lines.push(`**Type:** \`${type}\``);
    if (prop.description) {
      lines.push('');
      lines.push(prop.description);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render methods section.
 */
function renderMethods(members: SpecMember[] | undefined, offset = 0): string {
  const methods = getMethods(members);
  if (!methods.length) return '';

  const lines = [heading(2, 'Methods', offset), ''];

  for (const method of methods) {
    const sig = method.signatures?.[0];
    const params = formatParameters(sig);
    const returnType = formatReturnType(sig);

    lines.push(`### \`${method.name}${params}: ${returnType}\``);
    lines.push('');
    if (method.description) {
      lines.push(method.description);
      lines.push('');
    }

    // Method parameters
    if (sig?.parameters?.length) {
      lines.push('**Parameters:**');
      lines.push('');
      for (const param of sig.parameters) {
        const paramType = formatSchema(param.schema);
        const desc = param.description ? ` - ${param.description}` : '';
        lines.push(`- \`${param.name}\`: \`${paramType}\`${desc}`);
      }
      lines.push('');
    }

    // Method return
    if (sig?.returns) {
      const retType = formatSchema(sig.returns.schema);
      const desc = sig.returns.description ? ` - ${sig.returns.description}` : '';
      lines.push(`**Returns:** \`${retType}\`${desc}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Render enum members.
 */
function renderEnumMembers(members: SpecMember[] | undefined, offset = 0): string {
  if (!members?.length) return '';

  const lines = [heading(2, 'Members', offset), ''];

  for (const member of members) {
    lines.push(`### \`${member.name}\``);
    if (member.description) {
      lines.push('');
      lines.push(member.description);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render a single export to MDX.
 *
 * @param exp - The export to render
 * @param options - Markdown rendering options
 * @returns MDX string with frontmatter
 *
 * @example
 * ```ts
 * const mdx = exportToMarkdown(fn, {
 *   frontmatter: true,
 *   codeSignatures: true,
 *   sections: { examples: true }
 * })
 * ```
 */
export function exportToMarkdown(exp: SpecExport, options: MarkdownOptions = {}): string {
  const sections = { ...defaultSections, ...options.sections };
  const offset = options.headingOffset ?? 0;
  const parts: string[] = [];

  // Frontmatter
  if (options.frontmatter !== false) {
    parts.push(generateFrontmatter(exp, options.customFrontmatter));
  }

  // Title
  parts.push(heading(1, exp.name, offset));
  parts.push('');

  // Signature
  if (sections.signature) {
    const sig = buildSignatureString(exp);
    if (options.codeSignatures) {
      parts.push('```ts');
      parts.push(sig);
      parts.push('```');
    } else {
      parts.push(`\`${sig}\``);
    }
    parts.push('');
  }

  // Description
  if (sections.description && exp.description) {
    parts.push(exp.description);
    parts.push('');
  }

  // Deprecation notice
  if (exp.deprecated) {
    parts.push('> **Deprecated**');
    parts.push('');
  }

  // Kind-specific rendering
  const primarySig = exp.signatures?.[0];

  switch (exp.kind) {
    case 'function':
      if (sections.parameters) parts.push(renderParameters(primarySig, offset));
      if (sections.returns) parts.push(renderReturns(primarySig, offset));
      break;

    case 'class':
    case 'interface':
      if (sections.properties) parts.push(renderProperties(exp.members, offset));
      if (sections.methods) parts.push(renderMethods(exp.members, offset));
      break;

    case 'enum':
      if (sections.members) parts.push(renderEnumMembers(exp.members, offset));
      break;

    case 'type':
    case 'variable':
      // Already rendered signature, no additional sections
      break;
  }

  // Examples
  if (sections.examples) {
    parts.push(renderExamples(exp.examples, offset));
  }

  return `${parts.filter(Boolean).join('\n').trim()}\n`;
}

/**
 * Render entire spec to MDX.
 *
 * @param spec - The OpenPkg spec to render
 * @param options - Markdown options, optionally with export name for single export mode
 * @returns MDX string
 *
 * @example
 * ```ts
 * import { createDocs } from '@openpkg-ts/doc-generator'
 *
 * const docs = createDocs('./openpkg.json')
 *
 * // Full spec
 * const fullMdx = docs.toMarkdown()
 *
 * // Single export
 * const fnMdx = docs.toMarkdown({ export: 'greet' })
 * ```
 */
export function toMarkdown(spec: OpenPkg, options: ExportMarkdownOptions = {}): string {
  // Single export mode
  if (options.export) {
    const exp = spec.exports.find((e) => e.name === options.export || e.id === options.export);
    if (!exp) {
      throw new Error(`Export not found: ${options.export}`);
    }
    return exportToMarkdown(exp, options);
  }

  // Full spec mode - render all exports
  const parts: string[] = [];

  // Add spec header
  if (options.frontmatter !== false) {
    const frontmatter = {
      title: `${spec.meta.name} API Reference`,
      description: spec.meta.description || `API documentation for ${spec.meta.name}`,
      ...(options.customFrontmatter || {}),
    };

    const lines = ['---'];
    for (const [key, value] of Object.entries(frontmatter)) {
      if (typeof value === 'string') {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    lines.push('---', '');
    parts.push(lines.join('\n'));
  }

  parts.push(`# ${spec.meta.name} API Reference`);
  parts.push('');
  if (spec.meta.description) {
    parts.push(spec.meta.description);
    parts.push('');
  }

  // Group by kind
  const byKind: Record<string, SpecExport[]> = {};
  for (const exp of spec.exports) {
    if (!byKind[exp.kind]) byKind[exp.kind] = [];
    byKind[exp.kind].push(exp);
  }

  // Render by kind
  const kindOrder = ['function', 'class', 'interface', 'type', 'enum', 'variable'];
  for (const kind of kindOrder) {
    const exports = byKind[kind];
    if (!exports?.length) continue;

    parts.push(`## ${kind.charAt(0).toUpperCase() + kind.slice(1)}s`);
    parts.push('');

    for (const exp of exports) {
      // Use heading offset +1 since we're nested under kind heading
      const content = exportToMarkdown(exp, {
        ...options,
        frontmatter: false,
        headingOffset: 1,
      });
      parts.push(content);
    }
  }

  return `${parts.join('\n').trim()}\n`;
}
