'use client';

import { ClientDocsKitCode } from '@doccov/ui/docskit';
import type { RawCode } from 'codehike/code';

export interface CodeExampleProps {
  code: string;
  filename?: string;
  language?: string;
}

/**
 * Cleans up code by removing markdown code fence markers if present.
 */
function cleanCode(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift(); // Remove opening ```ts or ```typescript
    if (lines[lines.length - 1] === '```') {
      lines.pop(); // Remove closing ```
    }
    cleaned = lines.join('\n');
  }
  return cleaned;
}

export function CodeExample({ code, filename = 'example.ts', language = 'typescript' }: CodeExampleProps) {
  const cleaned = cleanCode(code);
  
  // Build RawCode object for ClientDocsKitCode
  // The meta field uses flags: 'c' for copyButton, 'n' for lineNumbers
  const codeblock: RawCode = {
    value: cleaned,
    lang: language,
    meta: `${filename} -cn`, // title + copyButton + lineNumbers flags (must prefix with -)
  };

  return <ClientDocsKitCode codeblock={codeblock} className="not-fumadocs-codeblock" />;
}
