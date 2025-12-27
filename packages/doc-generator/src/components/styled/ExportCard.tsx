'use client';

import { cn } from '@doccov/ui/lib/utils';
import Link from 'next/link';

export interface ExportCardProps {
  /** Function/export name */
  name: string;
  /** Description snippet */
  description?: string;
  /** Link to detail page */
  href: string;
  /** Export kind: function, type, variable, class, interface, enum */
  kind?: 'function' | 'type' | 'variable' | 'class' | 'interface' | 'enum';
  /** Custom className */
  className?: string;
}

/**
 * Card component for displaying exports in an index grid.
 * Features function name styling, description, and hover effects.
 */
export function ExportCard({
  name,
  description,
  href,
  kind = 'function',
  className,
}: ExportCardProps): React.ReactNode {
  const isFunction = kind === 'function';

  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-lg border border-border bg-card/50 p-4',
        'transition-all duration-200',
        'hover:border-border/80 hover:bg-card hover:shadow-md',
        'hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="flex items-baseline gap-1 mb-2">
        <span className="font-mono text-base font-medium text-foreground group-hover:text-primary transition-colors">
          {name}
        </span>
        {isFunction && (
          <span className="font-mono text-base text-muted-foreground">()</span>
        )}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}
    </Link>
  );
}
