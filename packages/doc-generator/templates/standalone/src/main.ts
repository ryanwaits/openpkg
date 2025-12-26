// Main entry for standalone API docs site
// This is a template that gets customized during build

async function init() {
  const content = document.getElementById('content');

  // Load API data
  try {
    const response = await fetch('/api.json');
    if (!response.ok) throw new Error('Failed to load API data');

    const spec = await response.json();
    renderDocs(spec);
  } catch (err) {
    if (content) {
      content.innerHTML = `<p class="text-red-500">Failed to load documentation: ${err}</p>`;
    }
  }

  // Initialize Pagefind search if available
  initSearch();
}

function renderDocs(spec: {
  name: string;
  description?: string;
  exports: Array<{
    id: string;
    name: string;
    kind: string;
    signature: string;
    description?: string;
    deprecated?: boolean;
    parameters?: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
    returns?: {
      type: string;
      description?: string;
    };
    members?: Array<{
      name: string;
      kind: string;
      type?: string;
      description?: string;
    }>;
  }>;
}) {
  const content = document.getElementById('content');
  if (!content) return;

  // Group by kind
  const byKind: Record<string, typeof spec.exports> = {};
  for (const exp of spec.exports) {
    if (!byKind[exp.kind]) byKind[exp.kind] = [];
    byKind[exp.kind].push(exp);
  }

  const kindOrder = ['function', 'class', 'interface', 'type', 'enum', 'variable'];
  const sections = kindOrder
    .filter((kind) => byKind[kind]?.length)
    .map((kind) => {
      const exports = byKind[kind];
      const cards = exports.map(renderExportCard).join('');
      return `
        <section class="kind-section">
          <h2 class="text-2xl font-semibold mb-6 capitalize">${kind}s</h2>
          ${cards}
        </section>
      `;
    })
    .join('');

  content.innerHTML = sections;
}

function renderExportCard(exp: {
  id: string;
  name: string;
  signature: string;
  description?: string;
  deprecated?: boolean;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  returns?: {
    type: string;
    description?: string;
  };
  members?: Array<{
    name: string;
    kind: string;
    type?: string;
    description?: string;
  }>;
}): string {
  const deprecated = exp.deprecated
    ? '<span class="text-orange-500 text-sm ml-2">[Deprecated]</span>'
    : '';
  const desc = exp.description
    ? `<p class="mt-3 text-zinc-600 dark:text-zinc-400">${escapeHtml(exp.description)}</p>`
    : '';

  let details = '';

  // Parameters
  if (exp.parameters?.length) {
    const rows = exp.parameters
      .map(
        (p) => `
      <tr>
        <td><code>${escapeHtml(p.name)}</code></td>
        <td><code>${escapeHtml(p.type)}</code></td>
        <td>${p.required ? 'Yes' : 'No'}</td>
        <td>${p.description ? escapeHtml(p.description) : '-'}</td>
      </tr>
    `,
      )
      .join('');

    details += `
      <h4 class="font-medium mt-4 mb-2">Parameters</h4>
      <table class="param-table">
        <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Returns
  if (exp.returns) {
    details += `
      <h4 class="font-medium mt-4 mb-2">Returns</h4>
      <p><code>${escapeHtml(exp.returns.type)}</code>${exp.returns.description ? ` - ${escapeHtml(exp.returns.description)}` : ''}</p>
    `;
  }

  // Members
  if (exp.members?.length) {
    const items = exp.members
      .map(
        (m) => `
      <li><code>${escapeHtml(m.name)}</code>${m.type ? `: <code>${escapeHtml(m.type)}</code>` : ''}${m.description ? ` - ${escapeHtml(m.description)}` : ''}</li>
    `,
      )
      .join('');

    details += `
      <h4 class="font-medium mt-4 mb-2">Members</h4>
      <ul class="list-disc list-inside space-y-1">${items}</ul>
    `;
  }

  return `
    <article class="export-card" id="${exp.id}">
      <h3 class="text-lg font-semibold">${escapeHtml(exp.name)}${deprecated}</h3>
      <pre class="signature"><code>${escapeHtml(exp.signature)}</code></pre>
      ${desc}
      ${details}
    </article>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function initSearch() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const searchResults = document.getElementById('search-results');

  if (!searchInput || !searchResults) return;

  // Try to load Pagefind
  try {
    // @ts-ignore - Pagefind is loaded at runtime
    const pagefind = await import('/_pagefind/pagefind.js');
    await pagefind.init();

    searchInput.addEventListener('input', async (e) => {
      const query = (e.target as HTMLInputElement).value;
      if (!query) {
        searchResults.innerHTML = '';
        return;
      }

      const search = await pagefind.search(query);
      const results = await Promise.all(
        search.results
          .slice(0, 5)
          .map((r: { data: () => Promise<{ url: string; title: string; excerpt: string }> }) =>
            r.data(),
          ),
      );

      searchResults.innerHTML = results
        .map(
          (r: { url: string; title: string; excerpt: string }) => `
        <a href="${r.url}" class="block p-3 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <div class="font-medium">${r.title}</div>
          <div class="text-sm text-zinc-500">${r.excerpt}</div>
        </a>
      `,
        )
        .join('');
    });
  } catch {
    // Pagefind not available, fallback to JSON search
    searchInput.placeholder = 'Search (JSON fallback)...';
  }
}

init();
