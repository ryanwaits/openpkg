'use client';

import { useCallback, useEffect, useState } from 'react';
import { ManageBillingButton } from '@/components/manage-billing-button';
import { UpgradeButton } from '@/components/upgrade-button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface BillingStatus {
  plan: 'free' | 'team' | 'pro' | 'enterprise' | 'hero';
  hasSubscription: boolean;
  usage: { aiCalls: number; resetAt: string | null };
  portalUrl: string | null;
}

const PLAN_LIMITS = {
  free: { aiCalls: 0, price: 0 },
  team: { aiCalls: 5000, price: 15 },
  pro: { aiCalls: 25000, price: 30 },
  enterprise: { aiCalls: Infinity, price: null },
  hero: { aiCalls: 25000, price: 0 },
};

const PLAN_COLORS = {
  free: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  team: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  pro: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  hero: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
};

export default function BillingPage() {
  const { currentOrg, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const data = await api<BillingStatus>(`/billing/status?orgId=${currentOrg.id}`);
      setStatus(data);
    } catch {
      setError('Failed to load billing status');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    if (currentOrg) {
      fetchStatus();
    }
  }, [currentOrg, fetchStatus]);

  if (authLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!currentOrg) {
    return <div className="text-muted-foreground">No organization selected</div>;
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading billing...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!status) return null;

  const planInfo = PLAN_LIMITS[status.plan] || PLAN_LIMITS.free;
  const usagePercent =
    planInfo.aiCalls > 0 ? Math.min(100, (status.usage.aiCalls / planInfo.aiCalls) * 100) : 0;
  const resetDate = status.usage.resetAt
    ? new Date(status.usage.resetAt).toLocaleDateString()
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current Plan */}
      <div className="p-6 border rounded-lg bg-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-lg">Current Plan</h2>
              <span
                className={`px-2 py-0.5 rounded text-sm font-medium capitalize ${PLAN_COLORS[status.plan]}`}
              >
                {status.plan}
              </span>
            </div>
            {planInfo.price !== null && (
              <p className="text-muted-foreground mt-1">
                {planInfo.price === 0 ? 'Free' : `$${planInfo.price}/user/month`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {status.plan === 'free' && <UpgradeButton plan="team">Upgrade to Team</UpgradeButton>}
            {status.plan === 'team' && (
              <>
                <UpgradeButton plan="pro">Upgrade to Pro</UpgradeButton>
                <ManageBillingButton />
              </>
            )}
            {(status.plan === 'pro' || status.plan === 'enterprise' || status.plan === 'hero') && (
              <ManageBillingButton />
            )}
          </div>
        </div>
      </div>

      {/* AI Usage (team+ only) */}
      {planInfo.aiCalls > 0 && (
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="font-semibold mb-4">AI Usage</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>AI Calls</span>
              <span className="text-muted-foreground">
                {status.usage.aiCalls.toLocaleString()} / {planInfo.aiCalls.toLocaleString()} this
                month
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {resetDate && <p className="text-xs text-muted-foreground">Resets {resetDate}</p>}
          </div>
        </div>
      )}

      {/* Free tier upsell */}
      {status.plan === 'free' && (
        <div className="p-4 bg-muted/40 rounded-lg text-sm text-muted-foreground">
          <strong>Upgrade to unlock:</strong> Private repos, AI-powered doc generation, coverage
          trends, and more.
        </div>
      )}
    </div>
  );
}
