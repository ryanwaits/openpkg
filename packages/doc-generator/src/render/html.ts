import type { OpenPkg, SpecExample, SpecExport, SpecMember, SpecSignature } from '@openpkg-ts/spec';
import {
  buildSignatureString,
  formatParameters,
  formatReturnType,
  formatSchema,
  getMethods,
  getProperties,
} from '../core/query';

export interface HTMLOptions {
  /** Page title override */
  title?: string;
  /** Include inline styles */
  includeStyles?: boolean;
  /** Custom CSS to inject */
  customCSS?: string;
  /** Custom head content */
  headContent?: string;
  /** Wrap in full HTML document */
  fullDocument?: boolean;
  /** Export to render (single export mode) */
  export?: string;
}

const defaultCSS = `
:root {
  --text: #1a1a1a;
  --text-muted: #666;
  --bg: #fff;
  --bg-code: #f5f5f5;
  --border: #e5e5e5;
  --accent: #0066cc;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: #e5e5e5;
    --text-muted: #999;
    --bg: #1a1a1a;
    --bg-code: #2a2a2a;
    --border: #333;
    --accent: #4da6ff;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}
h1, h2, h3, h4 { margin-top: 2rem; margin-bottom: 1rem; }
h1 { font-size: 2rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
h2 { font-size: 1.5rem; color: var(--text-muted); }
h3 { font-size: 1.1rem; }
p { margin-bottom: 1rem; }
code {
  font-family: var(--font-mono);
  background: var(--bg-code);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}
pre {
  background: var(--bg-code);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
}
pre code { background: none; padding: 0; }
.signature { font-family: var(--font-mono); font-size: 0.95rem; }
.deprecated { opacity: 0.6; }
.deprecated::before { content: "[Deprecated] "; color: #cc6600; }
.badge {
  display: inline-block;
  padding: 0.2em 0.5em;
  font-size: 0.75rem;
  border-radius: 4px;
  background: var(--accent);
  color: white;
  margin-left: 0.5rem;
}
.param-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
.param-table th, .param-table td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.param-table th { font-weight: 600; color: var(--text-muted); }
.kind-section { margin-top: 3rem; }
.export-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
}
.export-card h3 { margin-top: 0; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
nav { margin-bottom: 2rem; }
nav ul { list-style: none; display: flex; flex-wrap: wrap; gap: 1rem; }
nav a { padding: 0.5rem 1rem; background: var(--bg-code); border-radius: 4px; }
`;

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSignature(exp: SpecExport): string {
  const sig = buildSignatureString(exp);
  return `<pre class="signature"><code>${escapeHTML(sig)}</code></pre>`;
}

function renderParameters(sig: SpecSignature | undefined): string {
  if (!sig?.parameters?.length) return '';

  const rows = sig.parameters
    .map((p) => {
      const type = escapeHTML(formatSchema(p.schema));
      const required = p.required !== false ? 'required' : 'optional';
      const desc = p.description ? escapeHTML(p.description) : '-';
      const rest = p.rest ? '...' : '';
      return `
        <tr>
          <td><code>${rest}${escapeHTML(p.name)}</code></td>
          <td><code>${type}</code></td>
          <td>${required}</td>
          <td>${desc}</td>
        </tr>`;
    })
    .join('');

  return `
    <h3>Parameters</h3>
    <table class="param-table">
      <thead>
        <tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderReturns(sig: SpecSignature | undefined): string {
  if (!sig?.returns) return '';

  const type = escapeHTML(formatSchema(sig.returns.schema));
  const desc = sig.returns.description ? `<p>${escapeHTML(sig.returns.description)}</p>` : '';

  return `
    <h3>Returns</h3>
    <p><code>${type}</code></p>
    ${desc}`;
}

function renderExamples(examples: (string | SpecExample)[] | undefined): string {
  if (!examples?.length) return '';

  const blocks = examples
    .map((ex) => {
      if (typeof ex === 'string') {
        return `<pre><code>${escapeHTML(ex)}</code></pre>`;
      }
      const title = ex.title ? `<h4>${escapeHTML(ex.title)}</h4>` : '';
      const desc = ex.description ? `<p>${escapeHTML(ex.description)}</p>` : '';
      return `${title}${desc}<pre><code class="language-${ex.language || 'ts'}">${escapeHTML(ex.code)}</code></pre>`;
    })
    .join('');

  return `<h3>Examples</h3>${blocks}`;
}

function renderProperties(members: SpecMember[] | undefined): string {
  const props = getProperties(members);
  if (!props.length) return '';

  const rows = props
    .map((p) => {
      const type = escapeHTML(formatSchema(p.schema));
      const desc = p.description ? escapeHTML(p.description) : '-';
      return `
        <tr>
          <td><code>${escapeHTML(p.name || '')}</code></td>
          <td><code>${type}</code></td>
          <td>${desc}</td>
        </tr>`;
    })
    .join('');

  return `
    <h3>Properties</h3>
    <table class="param-table">
      <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderMethods(members: SpecMember[] | undefined): string {
  const methods = getMethods(members);
  if (!methods.length) return '';

  const items = methods
    .map((m) => {
      const sig = m.signatures?.[0];
      const params = escapeHTML(formatParameters(sig));
      const returnType = escapeHTML(formatReturnType(sig));
      const desc = m.description ? `<p>${escapeHTML(m.description)}</p>` : '';

      return `
        <div class="method">
          <h4><code>${escapeHTML(m.name || '')}${params}: ${returnType}</code></h4>
          ${desc}
        </div>`;
    })
    .join('');

  return `<h3>Methods</h3>${items}`;
}

function renderEnumMembers(members: SpecMember[] | undefined): string {
  if (!members?.length) return '';

  const items = members
    .map((m) => {
      const desc = m.description ? ` - ${escapeHTML(m.description)}` : '';
      return `<li><code>${escapeHTML(m.name || '')}</code>${desc}</li>`;
    })
    .join('');

  return `<h3>Members</h3><ul>${items}</ul>`;
}

/**
 * Render a single export to HTML.
 */
function renderExport(exp: SpecExport): string {
  const deprecated = exp.deprecated ? ' deprecated' : '';
  const badge = exp.deprecated ? '<span class="badge">Deprecated</span>' : '';
  const desc = exp.description ? `<p>${escapeHTML(exp.description)}</p>` : '';
  const primarySig = exp.signatures?.[0];

  let content = '';

  switch (exp.kind) {
    case 'function':
      content = renderParameters(primarySig) + renderReturns(primarySig);
      break;
    case 'class':
    case 'interface':
      content = renderProperties(exp.members) + renderMethods(exp.members);
      break;
    case 'enum':
      content = renderEnumMembers(exp.members);
      break;
  }

  content += renderExamples(exp.examples);

  return `
    <article class="export-card${deprecated}" id="${exp.id}">
      <h3>${escapeHTML(exp.name)}${badge}</h3>
      ${renderSignature(exp)}
      ${desc}
      ${content}
    </article>`;
}

/**
 * Render spec to standalone HTML page.
 *
 * @param spec - The OpenPkg spec to render
 * @param options - HTML rendering options
 * @returns Complete HTML document or fragment
 *
 * @example
 * ```ts
 * import { createDocs } from '@openpkg-ts/doc-generator'
 *
 * const docs = createDocs('./openpkg.json')
 *
 * // Full HTML page
 * const html = docs.toHTML({ includeStyles: true })
 * fs.writeFileSync('api.html', html)
 *
 * // Single export, no document wrapper
 * const fragment = docs.toHTML({ export: 'greet', fullDocument: false })
 * ```
 */
export function toHTML(spec: OpenPkg, options: HTMLOptions = {}): string {
  const { includeStyles = true, fullDocument = true, customCSS = '' } = options;

  // Single export mode
  if (options.export) {
    const exp = spec.exports.find((e) => e.name === options.export || e.id === options.export);
    if (!exp) {
      throw new Error(`Export not found: ${options.export}`);
    }

    const content = renderExport(exp);

    if (!fullDocument) return content;

    const title = options.title || `${exp.name} | ${spec.meta.name}`;
    const styles = includeStyles ? `<style>${defaultCSS}${customCSS}</style>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  ${styles}
  ${options.headContent || ''}
</head>
<body>
  <main>
    <h1>${escapeHTML(exp.name)}</h1>
    ${content}
  </main>
</body>
</html>`;
  }

  // Full spec mode
  const title = options.title || `${spec.meta.name} API Reference`;
  const description = spec.meta.description ? `<p>${escapeHTML(spec.meta.description)}</p>` : '';

  // Group by kind
  const byKind: Record<string, SpecExport[]> = {};
  for (const exp of spec.exports) {
    if (!byKind[exp.kind]) byKind[exp.kind] = [];
    byKind[exp.kind].push(exp);
  }

  // Build navigation
  const navItems = Object.entries(byKind)
    .map(([kind, exports]) => {
      const links = exports.map((e) => `<a href="#${e.id}">${escapeHTML(e.name)}</a>`).join('');
      return `<li><strong>${kind}s:</strong> ${links}</li>`;
    })
    .join('');

  const nav = `<nav><ul>${navItems}</ul></nav>`;

  // Render sections
  const kindOrder = ['function', 'class', 'interface', 'type', 'enum', 'variable'];
  const sections = kindOrder
    .filter((kind) => byKind[kind]?.length)
    .map((kind) => {
      const exports = byKind[kind].map(renderExport).join('');
      return `
        <section class="kind-section">
          <h2>${kind.charAt(0).toUpperCase() + kind.slice(1)}s</h2>
          ${exports}
        </section>`;
    })
    .join('');

  const content = `
    <header>
      <h1>${escapeHTML(spec.meta.name)} API Reference</h1>
      ${description}
    </header>
    ${nav}
    ${sections}`;

  if (!fullDocument) return content;

  const styles = includeStyles ? `<style>${defaultCSS}${customCSS}</style>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <meta name="description" content="${escapeHTML(spec.meta.description || '')}">
  ${styles}
  ${options.headContent || ''}
</head>
<body>
  <main>
    ${content}
  </main>
</body>
</html>`;
}
