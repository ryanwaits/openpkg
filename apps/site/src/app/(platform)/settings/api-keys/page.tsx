'use client';

import { Button } from '@doccov/ui/button';
import { Input } from '@doccov/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { UpgradeButton } from '@/components/upgrade-button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { currentOrg, isLoading: authLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const data = await api<{ keys: ApiKey[] }>(`/api-keys?orgId=${currentOrg.id}`);
      setKeys(data.keys);
    } catch {
      setError('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    if (currentOrg) {
      fetchKeys();
    }
  }, [currentOrg, fetchKeys]);

  const createKey = async () => {
    if (!currentOrg || !newKeyName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const data = await api<{ key: string; id: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ orgId: currentOrg.id, name: newKeyName.trim() }),
      });
      setCreatedKey(data.key);
      setNewKeyName('');
      fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setIsCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    try {
      await api(`/api-keys/${keyId}`, { method: 'DELETE' });
      fetchKeys();
    } catch {
      setError('Failed to revoke key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (authLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  // Free tier: show upgrade prompt
  if (currentOrg?.plan === 'free') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">API Keys require a paid plan</h2>
        <p className="mt-2 text-muted-foreground">
          The free tier runs locally. Upgrade to use cloud features.
        </p>
        <div className="mt-4">
          <UpgradeButton plan="team">Upgrade to Team</UpgradeButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground mt-1">Manage API keys for CLI/CI integration</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Newly created key alert */}
      {createdKey && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Save this key now - it won't be shown again!
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 p-2 bg-white dark:bg-black rounded font-mono text-sm break-all">
              {createdKey}
            </code>
            <Button variant="secondary" size="sm" onClick={() => copyToClipboard(createdKey)}>
              Copy
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="mt-2 text-sm text-amber-600 dark:text-amber-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create new key */}
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="font-semibold mb-4">Create API Key</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              inputSize="sm"
              placeholder="Key name (e.g., CI Pipeline)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createKey()}
            />
          </div>
          <Button onClick={createKey} isLoading={isCreating} disabled={!newKeyName.trim()}>
            Create Key
          </Button>
        </div>
      </div>

      {/* Keys list */}
      <div className="border rounded-lg">
        <div className="p-4 border-b bg-muted/40">
          <h2 className="font-semibold">Active Keys</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No API keys yet. Create one above.
          </div>
        ) : (
          <div className="divide-y">
            {keys.map((key) => (
              <div key={key.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{key.name}</div>
                  <div className="text-sm text-muted-foreground font-mono">{key.keyPrefix}...</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && (
                      <> &middot; Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>
                    )}
                    {key.expiresAt && (
                      <> &middot; Expires {new Date(key.expiresAt).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => revokeKey(key.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage info */}
      <div className="p-4 bg-muted/40 rounded-lg text-sm text-muted-foreground">
        <strong>Usage:</strong> Set{' '}
        <code className="font-mono bg-black/10 dark:bg-white/10 px-1 rounded">DOCCOV_API_KEY</code>{' '}
        in your environment to use cloud features in CLI/CI.
      </div>
    </div>
  );
}
