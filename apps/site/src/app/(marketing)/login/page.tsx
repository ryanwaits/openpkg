'use client';

import { Button } from '@doccov/ui/button';
import { Github } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { authClient } from '../../../lib/auth-client';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { refetch } = useAuth();
  const router = useRouter();

  // Listen for popup auth completion
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data?.type === 'oauth-callback' && event.data?.success) {
        await refetch();
        router.push('/dashboard');
      } else if (event.data?.type === 'oauth-callback' && !event.data?.success) {
        console.error('Auth failed:', event.data?.error);
        setIsLoading(false);
      }
    },
    [refetch, router]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: 'github',
        callbackURL: `${window.location.origin}/auth/callback`,
        disableRedirect: true,
      });

      if (result.data?.url) {
        // Open popup for OAuth
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          result.data.url,
          'oauth-popup',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        if (!popup) {
          // Popup blocked - fall back to redirect
          window.location.href = result.data.url;
        }
      } else if (result.error) {
        console.error('Auth error:', result.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="mx-auto max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold">Sign in to DocCov</h1>
        <p className="text-muted-foreground">Continue with your GitHub account to get started.</p>
        <Button size="lg" className="w-full" onClick={handleGitHubLogin} isLoading={isLoading}>
          <Github className="mr-2 h-5 w-5" />
          Continue with GitHub
        </Button>
        <p className="text-sm text-muted-foreground">
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
