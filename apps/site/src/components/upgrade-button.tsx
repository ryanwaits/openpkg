'use client';

import { Button } from '@doccov/ui/button';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function UpgradeButton({
  plan,
  children,
}: {
  plan: 'team' | 'pro';
  children: React.ReactNode;
}) {
  const { currentOrg } = useAuth();

  const handleUpgrade = () => {
    if (!currentOrg) {
      window.location.href = '/login?callbackUrl=/pricing';
      return;
    }
    window.location.href = `${API_URL}/billing/checkout?plan=${plan}&orgId=${currentOrg.id}`;
  };

  return (
    <Button onClick={handleUpgrade} size="lg">
      {children}
    </Button>
  );
}
