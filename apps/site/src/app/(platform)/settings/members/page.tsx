'use client';

import { Button } from '@doccov/ui/button';
import { Copy, Trash2, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Member {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: 'admin' | 'member';
  expiresAt: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  member: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function MembersPage() {
  const { currentOrg, isLoading: authLoading } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const data = await api<{ members: Member[]; myRole: string }>(
        `/orgs/${currentOrg.slug}/members`,
      );
      setMembers(data.members);
      setMyRole(data.myRole);
    } catch {
      setError('Failed to load members');
    }
  }, [currentOrg]);

  const fetchInvites = useCallback(async () => {
    if (!currentOrg || !['owner', 'admin'].includes(myRole || '')) return;
    try {
      const data = await api<{ invites: Invite[] }>(`/orgs/${currentOrg.slug}/invites`);
      setInvites(data.invites);
    } catch {
      // Ignore - user might not have permission
    }
  }, [currentOrg, myRole]);

  useEffect(() => {
    if (currentOrg) {
      setIsLoading(true);
      fetchMembers().finally(() => setIsLoading(false));
    }
  }, [currentOrg, fetchMembers]);

  useEffect(() => {
    if (myRole) {
      fetchInvites();
    }
  }, [myRole, fetchInvites]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !inviteEmail) return;

    setIsInviting(true);
    try {
      const result = await api<{ inviteUrl: string }>(`/orgs/${currentOrg.slug}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteUrl(result.inviteUrl);
      fetchInvites();
    } catch {
      setError('Failed to create invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyUrl = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentOrg || !confirm('Are you sure you want to remove this member?')) return;
    try {
      await api(`/orgs/${currentOrg.slug}/members/${userId}`, { method: 'DELETE' });
      fetchMembers();
    } catch {
      setError('Failed to remove member');
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!currentOrg) return;
    try {
      await api(`/orgs/${currentOrg.slug}/invites/${inviteId}`, { method: 'DELETE' });
      fetchInvites();
    } catch {
      setError('Failed to delete invite');
    }
  };

  const canManageMembers = myRole === 'owner' || myRole === 'admin';

  if (authLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!currentOrg) {
    return <div className="text-muted-foreground">No organization selected</div>;
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading members...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            {members.length} member{members.length !== 1 ? 's' : ''} in {currentOrg.name}
          </p>
        </div>
        {canManageMembers && (
          <Button
            onClick={() => setShowInviteForm(!showInviteForm)}
            leftIcon={<UserPlus className="size-4" />}
          >
            Invite Member
          </Button>
        )}
      </div>

      {/* Invite form */}
      {showInviteForm && canManageMembers && (
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="font-semibold mb-4">Invite a Team Member</h2>
          {inviteUrl ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Share this link with <strong>{inviteEmail}</strong>:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded bg-muted text-sm font-mono"
                />
                <Button
                  variant="secondary"
                  onClick={handleCopyUrl}
                  leftIcon={<Copy className="size-4" />}
                >
                  Copy
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setInviteUrl(null);
                    setInviteEmail('');
                    setShowInviteForm(false);
                  }}
                >
                  Done
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setInviteUrl(null);
                    setInviteEmail('');
                  }}
                >
                  Invite Another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="invite-email" className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full px-3 py-2 border rounded bg-background"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="invite-role" className="block text-sm font-medium mb-1">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                    className="px-3 py-2 border rounded bg-background"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? 'Creating...' : 'Create Invite Link'}
                </Button>
                <Button variant="ghost" onClick={() => setShowInviteForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left text-sm font-medium px-4 py-3">Member</th>
              <th className="text-left text-sm font-medium px-4 py-3">Role</th>
              <th className="text-left text-sm font-medium px-4 py-3">Joined</th>
              {canManageMembers && <th className="w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {member.image ? (
                      <Image
                        src={member.image}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 rounded-full"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {(member.name || member.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{member.name || 'Unnamed'}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[member.role]}`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString()}
                </td>
                {canManageMembers && (
                  <td className="px-4 py-3">
                    {member.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {canManageMembers && invites.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Pending Invites</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left text-sm font-medium px-4 py-3">Email</th>
                  <th className="text-left text-sm font-medium px-4 py-3">Role</th>
                  <th className="text-left text-sm font-medium px-4 py-3">Expires</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-4 py-3">{invite.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[invite.role]}`}
                      >
                        {ROLE_LABELS[invite.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteInvite(invite.id)}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
