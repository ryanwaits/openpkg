'use client';

import { Button } from '@doccov/ui/button';
import { Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface InviteInfo {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  orgName: string;
  orgSlug: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading, refetch } = useAuth();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvite = useCallback(async () => {
    try {
      const data = await api<{ invite: InviteInfo }>(`/invites/${token}`);
      setInvite(data.invite);
    } catch {
      setError('This invite link is invalid or has expired.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with callback
      window.location.href = `/login?callbackUrl=/invite/${token}`;
      return;
    }

    setIsAccepting(true);
    try {
      const result = await api<{ success: boolean; orgSlug?: string }>(`/invites/${token}/accept`, {
        method: 'POST',
      });

      if (result.success) {
        await refetch();
        router.push('/dashboard');
      }
    } catch {
      setError('Failed to accept invite. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 text-center">
          <div className="size-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto mb-4">
            <Users className="size-6 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Invalid Invite</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'This invite link is invalid or has expired.'}
          </p>
          <Button variant="secondary" onClick={() => router.push('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md mx-auto p-6">
        <div className="border rounded-lg p-6 bg-card text-center">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="size-6 text-primary" />
          </div>

          <h1 className="text-xl font-semibold mb-2">Join {invite.orgName}</h1>

          <p className="text-muted-foreground mb-6">
            You&apos;ve been invited to join <strong>{invite.orgName}</strong> as a{' '}
            <span className="capitalize">{invite.role}</span>.
          </p>

          {user ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Signed in as <strong>{user.email}</strong>
              </p>
              <Button onClick={handleAccept} disabled={isAccepting} className="w-full">
                {isAccepting ? 'Joining...' : 'Accept Invite'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Sign in to accept this invite</p>
              <Button onClick={handleAccept} className="w-full">
                Sign in & Join
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Expires {new Date(invite.expiresAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
