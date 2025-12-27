'use client';

import type { OpenPkg, SpecExport } from '@openpkg-ts/spec';
import { cn } from '@doccov/ui/lib/utils';
import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatSchema } from '../../core/query';
import { CodeTabs, type CodeTab } from './CodeTabs';
import { ImportSection } from './ImportSection';
import { ParameterItem } from './ParameterItem';

export interface FunctionPageProps {
  export: SpecExport;
  spec: OpenPkg;
  /** Custom code example renderer */
  renderExample?: (code: string, filename: string) => ReactNode;
}

/**
 * AI SDK-style function page with two-column layout.
 * Left: parameters, returns. Right: sticky code examples.
 */
export function FunctionPage({
  export: exp,
  spec,
  renderExample,
}: FunctionPageProps): ReactNode {
  const [copied, setCopied] = useState(false);
  const sig = exp.signatures?.[0];
  const hasExamples = exp.examples && exp.examples.length > 0;
  const hasParams = sig?.parameters && sig.parameters.length > 0;

  // Build import statement
  const packageName = spec.name || 'package';
  const importStatement = `import { ${exp.name} } from '${packageName}'`;

  // Copy function name
  const handleCopyName = () => {
    navigator.clipboard.writeText(exp.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // Build code tabs from examples
  const codeTabs: CodeTab[] = hasExamples
    ? exp.examples!.map((example, index) => {
        const code = typeof example === 'string' ? example : example.code;
        const title = typeof example === 'string' ? `Example ${index + 1}` : (example.title || `Example ${index + 1}`);
        const filename = `${exp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index + 1}.ts`;

        return {
          label: title,
          code,
          content: renderExample ? (
            renderExample(code, filename)
          ) : (
            <pre className="p-4 overflow-x-auto">
              <code className="font-mono text-sm text-foreground">{code}</code>
            </pre>
          ),
        };
      })
    : [];

  return (
    <div className="space-y-6 not-prose">
      {/* Function name header with copy */}
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold text-foreground">
          {exp.name}
          <span className="text-muted-foreground">()</span>
        </h1>
        <button
          type="button"
          onClick={handleCopyName}
          className={cn(
            'p-1.5 rounded',
            'text-muted-foreground hover:text-foreground',
            'transition-colors cursor-pointer',
          )}
          aria-label="Copy function name"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>

      {/* Description */}
      {exp.description && (
        <p className="text-muted-foreground leading-relaxed text-base">
          {exp.description}
        </p>
      )}

      {/* Import section */}
      <ImportSection importStatement={importStatement} />

      {/* Two-column layout */}
      <div
        className={cn(
          'grid gap-8',
          hasExamples ? 'lg:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {/* Left column: Parameters & Returns */}
        <div className="space-y-8">
          {/* Parameters */}
          {hasParams && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Parameters
              </h2>
              <div className="rounded-lg border border-border bg-card/50">
                {sig.parameters!.map((param, index) => (
                  <ParameterItem key={param.name ?? index} param={param} />
                ))}
              </div>
            </section>
          )}

          {/* Returns */}
          {sig?.returns && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Returns
              </h2>
              <div className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-mono text-sm text-foreground">
                    {formatSchema(sig.returns.schema)}
                  </span>
                </div>
                {sig.returns.description && (
                  <p className="text-sm text-muted-foreground">
                    {sig.returns.description}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right column: Examples (sticky) */}
        {hasExamples && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Examples
            </h2>
            {codeTabs.length === 1 ? (
              <div className="rounded-lg border border-border overflow-hidden bg-background">
                {codeTabs[0].content}
              </div>
            ) : (
              <CodeTabs tabs={codeTabs} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
