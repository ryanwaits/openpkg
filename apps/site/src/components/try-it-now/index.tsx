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

interface WorkspacePackage {
  name: string;
  path: string;
  private: boolean;
}

interface RepoInfo {
  url: string;
  owner: string;
  repo: string;
  packages: WorkspacePackage[];
}

/**
 * Check if input looks like a GitHub URL
 */
function isGitHubUrl(input: string): boolean {
  return input.includes('github.com/') || input.startsWith('https://github.com');
}

export function TryItNow() {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [result, setResult] = useState<AnalysisSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // GitHub monorepo state
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);

  /**
   * Analyze npm package (existing flow)
   */
  const analyzeNpmPackage = useCallback(async (pkg: string) => {
    if (isRunning || !pkg.trim()) return;

    const trimmedPkg = pkg.trim();
    setIsRunning(true);
    setLines([{ type: 'command', text: `doccov check ${trimmedPkg}` }]);
    setResult(null);
    setError(null);
    setRepoInfo(null);

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

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          return;
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

  /**
   * Detect packages in GitHub repo (for monorepos)
   */
  const detectRepo = useCallback(async (url: string) => {
    if (isRunning || !url.trim()) return;

    setIsRunning(true);
    setLines([{ type: 'command', text: `doccov detect ${url}` }]);
    setResult(null);
    setError(null);
    setRepoInfo(null);

    try {
      setLines((prev) => [...prev, { type: 'status', text: 'Detecting repository structure...' }]);

      const res = await fetch(`${API_URL}/demo/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Detection failed');
      }

      if (data.isMonorepo && data.packages.length > 0) {
        // Show package selector
        const publicPackages = data.packages.filter((p: WorkspacePackage) => !p.private);
        setRepoInfo({
          url,
          owner: data.owner,
          repo: data.repo,
          packages: publicPackages,
        });
        setLines((prev) => [
          ...prev,
          { type: 'log', text: `Monorepo detected (${data.packageManager})` },
          { type: 'success', text: `Found ${publicPackages.length} public packages` },
        ]);
        setIsRunning(false);
      } else {
        // Single package repo - analyze directly
        setLines((prev) => [
          ...prev,
          { type: 'log', text: `Single package repo (${data.packageManager})` },
        ]);
        analyzeRepo(url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Detection failed';
      setLines((prev) => [...prev, { type: 'error', text: message }]);
      setError(message);
      setIsRunning(false);
    }
  }, [isRunning]);

  /**
   * Analyze GitHub repo directly
   */
  const analyzeRepo = useCallback(async (url: string, pkg?: string) => {
    setIsRunning(true);
    if (pkg) {
      setLines((prev) => [
        ...prev,
        { type: 'command', text: `doccov check ${pkg}` },
      ]);
    }
    setResult(null);
    setError(null);

    try {
      const params = new URLSearchParams({ url });
      if (pkg) params.set('package', pkg);

      const eventSource = new EventSource(`${API_URL}/demo/analyze-repo?${params}`);

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

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          return;
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
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (isGitHubUrl(trimmed)) {
      detectRepo(trimmed);
    } else {
      analyzeNpmPackage(trimmed);
    }
  };

  const handlePackageClick = (pkg: string) => {
    setInput(pkg);
    analyzeNpmPackage(pkg);
  };

  const handleRepoPackageClick = (pkg: WorkspacePackage) => {
    if (!repoInfo) return;
    analyzeRepo(repoInfo.url, pkg.name);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    // Reset repo info when input changes
    if (repoInfo) {
      setRepoInfo(null);
    }
  };

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-3">Try it Now</h2>
          <p className="text-muted-foreground">
            Enter an npm package or GitHub URL to see its documentation coverage
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="lodash, zod, or https://github.com/org/repo..."
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={isRunning}
            className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <Button type="submit" disabled={isRunning || !input.trim()}>
            {isRunning ? 'Analyzing...' : isGitHubUrl(input) ? 'Detect' : 'Analyze'}
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

        {/* Monorepo package selector */}
        {repoInfo && repoInfo.packages.length > 0 && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/50">
            <p className="text-sm text-muted-foreground mb-3">
              Select a package to analyze from {repoInfo.owner}/{repoInfo.repo}:
            </p>
            <div className="flex flex-wrap gap-2">
              {repoInfo.packages.map((pkg) => (
                <button
                  key={pkg.name}
                  onClick={() => handleRepoPackageClick(pkg)}
                  disabled={isRunning}
                  className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {pkg.name}
                </button>
              ))}
            </div>
          </div>
        )}

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
