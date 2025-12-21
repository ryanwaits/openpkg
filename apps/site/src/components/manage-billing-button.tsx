'use client';

import { Button } from '@doccov/ui/button';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function ManageBillingButton() {
  const { currentOrg } = useAuth();
  if (!currentOrg) return null;

  return (
    <Button
      variant="secondary"
      onClick={() => {
        window.location.href = `${API_URL}/billing/portal?orgId=${currentOrg.id}`;
      }}
    >
      Manage Billing
    </Button>
  );
}
