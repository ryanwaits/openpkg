'use client';

import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    // Check if we're in a popup
    if (window.opener) {
      // Send success message to parent
      window.opener.postMessage({ type: 'oauth-callback', success: true }, window.location.origin);
      window.close();
    } else {
      // Not in popup - redirect to dashboard
      window.location.href = '/dashboard';
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
