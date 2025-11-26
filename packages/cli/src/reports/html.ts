import { renderMarkdown } from './markdown';
import type { ReportStats } from './stats';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderHtml(stats: ReportStats, options: { limit?: number } = {}): string {
  const md = renderMarkdown(stats, options);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocCov Report: ${escapeHtml(stats.packageName)}</title>
  <style>
    :root { --bg: #0d1117; --fg: #c9d1d9; --border: #30363d; --accent: #58a6ff; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2 { border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.5rem 1rem; text-align: left; }
    th { background: #161b22; }
    code { background: #161b22; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    a { color: var(--accent); }
  </style>
</head>
<body>
<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(md)}</pre>
</body>
</html>`;
}
