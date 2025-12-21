import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// ============ Users (Better Auth managed) ============
export interface UsersTable {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;

  // GitHub OAuth
  githubId: string | null;
  githubUsername: string | null;

  // Billing
  plan: 'free' | 'team' | 'pro' | 'enterprise' | 'hero';
  stripeCustomerId: string | null;

  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface SessionsTable {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface AccountsTable {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  idToken: string | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

// ============ Organizations ============
export interface OrganizationsTable {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;

  // GitHub (for private repo access later)
  githubOrg: string | null;
  githubInstallationId: string | null;

  // Billing
  plan: 'free' | 'team' | 'pro' | 'enterprise' | 'hero';
  stripeSubscriptionId: string | null;

  // Polar billing
  polarCustomerId: string | null;
  polarSubscriptionId: string | null;

  // Usage (denormalized for fast checks)
  aiCallsUsed: number;
  aiCallsResetAt: Date | null;

  createdAt: Generated<Date>;
}

export interface OrgMembersTable {
  id: string;
  orgId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Generated<Date>;
}

// ============ API Keys ============
export interface ApiKeysTable {
  id: string;
  orgId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string | null; // JSON array
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Generated<Date>;
}

// ============ Projects ============
export interface ProjectsTable {
  id: string;
  orgId: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;

  // Latest coverage (denormalized)
  coverageScore: number | null;
  driftCount: number | null;
  lastAnalyzedAt: Date | null;

  createdAt: Generated<Date>;
}

// ============ Usage Records ============
export interface UsageRecordsTable {
  id: string;
  orgId: string;
  feature: 'ai_generate' | 'ai_fix' | 'analysis';
  count: number;
  metadata: string | null; // JSON
  createdAt: Generated<Date>;
}

// ============ Coverage Snapshots ============
export interface CoverageSnapshotsTable {
  id: string;
  projectId: string;
  version: string | null; // e.g., "v1.2.0" or commit SHA
  branch: string | null;
  commitSha: string | null;

  // Overall coverage
  coveragePercent: number;
  documentedCount: number;
  totalCount: number;

  // Signal breakdown (optional detailed tracking)
  descriptionCount: number | null;
  paramsCount: number | null;
  returnsCount: number | null;
  examplesCount: number | null;

  // Drift tracking
  driftCount: number;

  // Source (ci, manual, etc)
  source: 'ci' | 'manual' | 'scheduled';

  createdAt: Generated<Date>;
}

// ============ Verification (Better Auth) ============
export interface VerificationTable {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

// ============ Database Interface ============
export interface Database {
  user: UsersTable;
  session: SessionsTable;
  account: AccountsTable;
  verification: VerificationTable;
  organizations: OrganizationsTable;
  org_members: OrgMembersTable;
  api_keys: ApiKeysTable;
  projects: ProjectsTable;
  usage_records: UsageRecordsTable;
  coverage_snapshots: CoverageSnapshotsTable;
}

// ============ Type Helpers ============
export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Organization = Selectable<OrganizationsTable>;
export type NewOrganization = Insertable<OrganizationsTable>;

export type OrgMember = Selectable<OrgMembersTable>;
export type Project = Selectable<ProjectsTable>;
export type ApiKey = Selectable<ApiKeysTable>;
export type CoverageSnapshot = Selectable<CoverageSnapshotsTable>;
export type NewCoverageSnapshot = Insertable<CoverageSnapshotsTable>;
