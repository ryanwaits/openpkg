import { type DiffReportData, renderDiffMarkdown } from './diff-markdown';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render a diff report as HTML
 */
export function renderDiffHtml(data: DiffReportData, options: { limit?: number } = {}): string {
  const md = renderDiffMarkdown(data, options);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocCov Diff: ${escapeHtml(data.baseName)} → ${escapeHtml(data.headName)}</title>
  <style>
    :root { --bg: #0d1117; --fg: #c9d1d9; --border: #30363d; --accent: #58a6ff; --success: #3fb950; --warning: #d29922; --danger: #f85149; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3 { border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h1 { color: var(--accent); }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.5rem 1rem; text-align: left; }
    th { background: #161b22; }
    code { background: #161b22; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    a { color: var(--accent); }
    .delta-positive { color: var(--success); }
    .delta-negative { color: var(--danger); }
    .delta-neutral { color: var(--fg); }
  </style>
</head>
<body>
<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(md)}</pre>
</body>
</html>`;
}
