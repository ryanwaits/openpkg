'use client';

import { BarChart3, Clock, TrendingUp, Users, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface UsageData {
  plan: string;
  seats: number;
  monthlyCost: number;
  aiCalls: {
    used: number;
    limit: number | 'unlimited';
    resetAt: string;
  };
  analyses: {
    limit: number | 'unlimited';
    resetAt: string;
  };
  history: {
    days: number;
  };
  privateRepos: boolean;
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  team: 'Team',
  pro: 'Pro',
  enterprise: 'Enterprise',
  hero: 'Hero',
};

export default function UsagePage() {
  const { currentOrg, isLoading: authLoading } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const data = await api<UsageData>(`/billing/usage?orgId=${currentOrg.id}`);
      setUsage(data);
    } catch {
      setError('Failed to load usage data');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    if (currentOrg) fetchUsage();
  }, [currentOrg, fetchUsage]);

  if (authLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!currentOrg) {
    return <div className="text-muted-foreground">No organization selected</div>;
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading usage...</div>;
  }

  if (error || !usage) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
        {error || 'Failed to load usage data'}
      </div>
    );
  }

  const aiUsagePercent =
    usage.aiCalls.limit !== 'unlimited' && usage.aiCalls.limit > 0
      ? Math.min(100, (usage.aiCalls.used / usage.aiCalls.limit) * 100)
      : 0;

  const resetDate = new Date(usage.aiCalls.resetAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground mt-1">Monitor your plan limits and resource usage</p>
      </div>

      {/* Plan summary */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{PLAN_NAMES[usage.plan] || usage.plan} Plan</h2>
            {usage.monthlyCost > 0 && (
              <p className="text-sm text-muted-foreground">
                {usage.seats} seat{usage.seats !== 1 ? 's' : ''} &times; $
                {Math.round(usage.monthlyCost / usage.seats)}/mo = ${usage.monthlyCost}/mo
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI Generation */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Zap className="size-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">AI Generation</h2>
            <p className="text-sm text-muted-foreground">
              {usage.aiCalls.limit === 'unlimited'
                ? 'Unlimited'
                : `${usage.aiCalls.limit.toLocaleString()} calls per month`}
            </p>
          </div>
        </div>

        {usage.aiCalls.limit !== 'unlimited' && usage.aiCalls.limit > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Used</span>
              <span className="text-muted-foreground tabular-nums">
                {usage.aiCalls.used.toLocaleString()} / {usage.aiCalls.limit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${aiUsagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" /> Resets {resetDate}
            </p>
          </div>
        )}

        {usage.aiCalls.limit === 0 && (
          <p className="text-sm text-muted-foreground">
            Upgrade to Team or Pro for AI-powered documentation generation.
          </p>
        )}
      </div>

      {/* Analyses */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <TrendingUp className="size-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">API Analyses</h2>
            <p className="text-sm text-muted-foreground">
              {usage.analyses.limit === 'unlimited'
                ? 'Unlimited analyses per day'
                : `${usage.analyses.limit.toLocaleString()} analyses per day`}
            </p>
          </div>
        </div>
      </div>

      {/* Coverage History */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <BarChart3 className="size-5 text-green-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Coverage History</h2>
            <p className="text-sm text-muted-foreground">
              {usage.history.days === 0
                ? 'Not available on Free plan'
                : usage.history.days === 365
                  ? 'Full year of history'
                  : `${usage.history.days} days of trends`}
            </p>
          </div>
        </div>
      </div>

      {/* Team Size */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Users className="size-5 text-violet-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {usage.seats} member{usage.seats !== 1 ? 's' : ''} in this organization
            </p>
          </div>
        </div>
      </div>

      {/* BYOK hint */}
      {usage.plan !== 'free' && usage.aiCalls.limit !== 'unlimited' && (
        <div className="p-4 bg-muted/40 rounded-lg text-sm text-muted-foreground">
          <strong>Tip:</strong> Set <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code> or{' '}
          <code className="bg-muted px-1 rounded">ANTHROPIC_API_KEY</code> in your CI environment
          for unlimited AI generation using your own API keys.
        </div>
      )}
    </div>
  );
}
