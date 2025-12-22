'use client';

import { Button } from '@doccov/ui/button';
import { Check, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PricingFeature {
  name: string;
  included: boolean | string;
}

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: PricingFeature[];
  cta: string;
  plan?: 'free' | 'team' | 'pro';
  highlighted?: boolean;
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  plan,
  highlighted,
}: PricingCardProps) {
  const { currentOrg, user } = useAuth();

  const handleClick = () => {
    if (!plan) return;

    if (plan === 'free') {
      window.location.href = user ? '/dashboard' : '/login';
      return;
    }

    if (!user) {
      window.location.href = `/login?callbackUrl=/pricing`;
      return;
    }

    if (!currentOrg) {
      window.location.href = '/dashboard';
      return;
    }

    window.location.href = `${API_URL}/billing/checkout?plan=${plan}&orgId=${currentOrg.id}`;
  };

  return (
    <div
      className={`flex flex-col rounded-lg border p-6 ${
        highlighted ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'
      }`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold">{price}</span>
          {period && <span className="text-muted-foreground">{period}</span>}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature.name} className="flex items-start gap-2 text-sm">
            {feature.included === true ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : feature.included === false ? (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            )}
            <span>
              {feature.name}
              {typeof feature.included === 'string' && (
                <span className="text-muted-foreground"> ({feature.included})</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <Button
        onClick={handleClick}
        variant={highlighted ? 'primary' : 'secondary'}
        size="lg"
        className="w-full"
      >
        {cta}
      </Button>
    </div>
  );
}
