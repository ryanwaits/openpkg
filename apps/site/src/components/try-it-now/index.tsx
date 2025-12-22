'use client';

import { useState, useCallback } from 'react';
import { Button } from '@doccov/ui/button';
import { TerminalOutput, type TerminalLine } from './terminal-output';
import { ResultCard, type AnalysisSummary } from './result-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const POPULAR_PACKAGES = [
  { name: 'zod', label: 'zod' },
  { name: 'axios', label: 'axios' },
  { name: 'date-fns', label: 'date-fns' },
  { name: 'lodash-es', label: 'lodash-es' },
  { name: '@tanstack/react-query', label: 'react-query' },
];

export function TryItNow() {
  const [packageName, setPackageName] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [result, setResult] = useState<AnalysisSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (pkg: string) => {
    if (isRunning || !pkg.trim()) return;

    const trimmedPkg = pkg.trim();
    setIsRunning(true);
    setLines([{ type: 'command', text: `doccov check ${trimmedPkg}` }]);
    setResult(null);
    setError(null);

    try {
      const eventSource = new EventSource(
        `${API_URL}/demo/analyze?package=${encodeURIComponent(trimmedPkg)}`,
      );

      eventSource.addEventListener('progress', (e) => {
        try {
          const data = JSON.parse(e.data);
          setLines((prev) => [
            ...prev,
            {
              type: data.type === 'status' ? 'status' : 'log',
              text: data.message,
              step: data.step,
            },
          ]);
        } catch {
          // Ignore parse errors
        }
      });

      eventSource.addEventListener('complete', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.data) {
            setResult(data.data);
            setLines((prev) => [
              ...prev,
              { type: 'success', text: `Coverage: ${data.data.coverage}%` },
            ]);
          }
        } catch {
          // Ignore parse errors
        }
        eventSource.close();
        setIsRunning(false);
      });

      eventSource.addEventListener('error', (e) => {
        try {
          // Try to parse error data if available
          const event = e as MessageEvent;
          if (event.data) {
            const data = JSON.parse(event.data);
            setLines((prev) => [...prev, { type: 'error', text: data.message || 'Analysis failed' }]);
            setError(data.message);
          } else {
            setLines((prev) => [...prev, { type: 'error', text: 'Connection failed' }]);
            setError('Connection failed');
          }
        } catch {
          setLines((prev) => [...prev, { type: 'error', text: 'Analysis failed' }]);
          setError('Analysis failed');
        }
        eventSource.close();
        setIsRunning(false);
      });

      // Handle connection errors
      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          return; // Already handled by error event
        }
        setLines((prev) => [...prev, { type: 'error', text: 'Connection lost' }]);
        setError('Connection lost');
        eventSource.close();
        setIsRunning(false);
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setLines((prev) => [...prev, { type: 'error', text: message }]);
      setError(message);
      setIsRunning(false);
    }
  }, [isRunning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze(packageName);
  };

  const handlePackageClick = (pkg: string) => {
    setPackageName(pkg);
    analyze(pkg);
  };

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-3">Try it Now</h2>
          <p className="text-muted-foreground">
            Enter any npm package to see its documentation coverage
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="lodash, zod, @tanstack/react-query..."
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            disabled={isRunning}
            className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <Button type="submit" disabled={isRunning || !packageName.trim()}>
            {isRunning ? 'Analyzing...' : 'Analyze'}
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          <span className="text-sm text-muted-foreground py-1">Try:</span>
          {POPULAR_PACKAGES.map(({ name, label }) => (
            <button
              key={name}
              onClick={() => handlePackageClick(name)}
              disabled={isRunning}
              className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {lines.length > 0 && <TerminalOutput lines={lines} isRunning={isRunning} />}

        {result && <ResultCard summary={result} />}

        {error && error.includes('limit') && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">{error}</p>
            <a href="/pricing">
              <Button size="sm" variant="secondary">Sign up for unlimited access</Button>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
