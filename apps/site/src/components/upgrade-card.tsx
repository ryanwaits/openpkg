'use client';

import { Button } from '@doccov/ui/button';
import { TrendingUp, Users, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Feature = 'trends' | 'ai' | 'seats';

const FEATURE_CONFIG: Record<
  Feature,
  { icon: typeof TrendingUp; title: string; description: string; plan: 'team' | 'pro' }
> = {
  trends: {
    icon: TrendingUp,
    title: 'Unlock Coverage Trends',
    description: 'Track documentation progress over 30 days with charts and insights.',
    plan: 'team',
  },
  ai: {
    icon: Zap,
    title: 'AI-Powered Documentation',
    description: 'Generate JSDoc for undocumented exports with AI.',
    plan: 'team',
  },
  seats: {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Add team members to manage documentation together.',
    plan: 'team',
  },
};

interface UpgradeCardProps {
  feature: Feature;
  className?: string;
}

export function UpgradeCard({ feature, className }: UpgradeCardProps) {
  const { currentOrg } = useAuth();
  const config = FEATURE_CONFIG[feature];
  const Icon = config.icon;

  const handleUpgrade = () => {
    if (!currentOrg) {
      window.location.href = '/login?callbackUrl=/pricing';
      return;
    }
    window.location.href = `${API_URL}/billing/checkout?plan=${config.plan}&orgId=${currentOrg.id}`;
  };

  return (
    <div
      className={`border border-border rounded-lg p-6 bg-card flex flex-col items-center text-center ${className || ''}`}
    >
      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="size-6 text-primary" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">{config.title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{config.description}</p>
      <Button onClick={handleUpgrade}>Upgrade to {config.plan === 'team' ? 'Team' : 'Pro'}</Button>
    </div>
  );
}
