'use client';

import { useState } from 'react';

export interface ExamplesSectionProps {
  examples: string[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-fd-secondary hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors opacity-0 group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

export function ExamplesSection({ examples }: ExamplesSectionProps): React.ReactNode {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!examples?.length) return null;

  const showTabs = examples.length > 1;

  return (
    <div className="my-6">
      <h3 className="text-lg font-semibold mb-3">Examples</h3>

      {showTabs && (
        <div className="flex gap-1 mb-2 border-b border-fd-border">
          {examples.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeIndex === index
                  ? 'text-fd-primary border-b-2 border-fd-primary -mb-px'
                  : 'text-fd-muted-foreground hover:text-fd-foreground'
              }`}
            >
              Example {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="group relative">
        <pre className="overflow-x-auto rounded-lg border border-fd-border bg-fd-secondary p-4">
          <code className="font-mono text-sm text-fd-foreground whitespace-pre">
            {examples[activeIndex]}
          </code>
        </pre>
        <CopyButton text={examples[activeIndex]} />
      </div>
    </div>
  );
}
