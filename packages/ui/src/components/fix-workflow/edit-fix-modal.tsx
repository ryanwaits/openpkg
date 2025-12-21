'use client';

import { type HighlightedCode, highlight, Pre } from 'codehike/code';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { theme } from '../docskit/code.config';
import type { EditFixModalProps } from './types';

export function EditFixModal({
  isOpen,
  onClose,
  issue,
  initialFix,
  language,
  onSave,
}: EditFixModalProps) {
  const [code, setCode] = useState(initialFix);
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset code when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode(initialFix);
    }
  }, [isOpen, initialFix]);

  // Highlight code as user types (debounced)
  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      highlight({ value: code, lang: language || 'typescript', meta: '' }, theme).then(
        setHighlighted,
      );
    }, 100);

    return () => clearTimeout(timeout);
  }, [code, language, isOpen]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = useCallback(() => {
    onSave(code);
    onClose();
  }, [code, onSave, onClose]);

  if (!isOpen) {
    return null;
  }

  const { background: _bg, ...style } = highlighted?.style ?? {};

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click is supplementary to Escape key */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handler is on window */}
      <div
        className="fixed inset-0 z-50 bg-black/60 animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-3xl max-h-[85vh]',
          'bg-card border border-border rounded-lg shadow-xl',
          'flex flex-col overflow-hidden',
          'animate-in fade-in zoom-in-95 duration-150',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Edit Fix</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Issue info */}
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5',
                'bg-warning/15 text-warning',
                'rounded text-xs font-mono font-medium',
              )}
            >
              <AlertTriangle className="size-3" />
              {issue.type}
            </span>
            <span className="text-sm text-muted-foreground font-mono">
              {issue.filePath}:{issue.line}
              {issue.functionName && ` · ${issue.functionName}()`}
            </span>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden relative">
          {/* Syntax highlighted preview (read-only) */}
          <div className="absolute inset-0 overflow-auto bg-dk-background p-4 pointer-events-none">
            {highlighted ? (
              <Pre
                code={highlighted}
                className="m-0 text-sm font-mono leading-relaxed !bg-transparent"
                style={style}
              />
            ) : (
              <pre className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">
                {code}
              </pre>
            )}
          </div>

          {/* Actual textarea for editing */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={cn(
              'absolute inset-0 w-full h-full resize-none',
              'bg-transparent p-4 text-sm font-mono leading-relaxed',
              'text-transparent caret-foreground',
              'outline-none',
            )}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {/* Preview section */}
        <div className="px-5 py-3 border-t border-border bg-success/5">
          <div className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-success" />
            <span className="text-muted-foreground">
              Changes will be applied when you accept this fix
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            <Check className="size-4" />
            Accept Custom Fix
          </Button>
        </div>
      </div>
    </>
  );
}
