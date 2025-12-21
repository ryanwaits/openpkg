'use client';

import { Button } from '@doccov/ui/button';
import { Github } from 'lucide-react';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'github',
          callbackURL: `${window.location.origin}/dashboard`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.redirect) {
        window.location.href = data.redirect;
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
