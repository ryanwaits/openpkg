'use client';

import type { SpecExample } from '@openpkg-ts/spec';
import { useState } from 'react';

export interface ExampleBlockProps {
  /** Examples to display (string or SpecExample) */
  examples: (string | SpecExample)[];
  /** Custom className */
  className?: string;
  /** Custom example renderer */
  renderExample?: (example: string | SpecExample, index: number) => React.ReactNode;
}

/**
 * Normalize example to string content.
 */
export function getExampleCode(example: string | SpecExample): string {
  if (typeof example === 'string') return example;
  return example.code;
}

/**
 * Get example title if available.
 */
export function getExampleTitle(example: string | SpecExample): string | undefined {
  if (typeof example === 'string') return undefined;
  return example.title;
}

/**
 * Get example language.
 */
export function getExampleLanguage(example: string | SpecExample): string {
  if (typeof example === 'string') return 'typescript';
  return example.language ?? 'typescript';
}

/**
 * Clean code by removing markdown fences.
 */
export function cleanCode(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift();
    if (lines[lines.length - 1] === '```') {
      lines.pop();
    }
    cleaned = lines.join('\n');
  }
  return cleaned;
}

/**
 * Headless example block component.
 *
 * @example
 * ```tsx
 * <ExampleBlock examples={exp.examples} />
 *
 * // Custom rendering
 * <ExampleBlock
 *   examples={exp.examples}
 *   renderExample={(ex) => <CustomCode code={getExampleCode(ex)} />}
 * />
 * ```
 */
export function ExampleBlock({
  examples,
  className,
  renderExample,
}: ExampleBlockProps): React.ReactNode {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!examples?.length) return null;

  const showTabs = examples.length > 1;
  const currentExample = examples[activeIndex];
  const code = cleanCode(getExampleCode(currentExample));

  if (renderExample) {
    return (
      <div className={className}>
        {showTabs && (
          <div data-tabs>
            {examples.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveIndex(index)}
                data-active={activeIndex === index}
              >
                {getExampleTitle(example) ?? `Example ${index + 1}`}
              </button>
            ))}
          </div>
        )}
        {renderExample(currentExample, activeIndex)}
      </div>
    );
  }

  return (
    <div className={className}>
      {showTabs && (
        <div data-tabs>
          {examples.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              data-active={activeIndex === index}
            >
              {getExampleTitle(example) ?? `Example ${index + 1}`}
            </button>
          ))}
        </div>
      )}
      <pre>
        <code data-language={getExampleLanguage(currentExample)}>{code}</code>
      </pre>
    </div>
  );
}
