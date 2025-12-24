/**
 * GitHub App utilities for token management
 */

import { SignJWT } from 'jose';
import { db } from './db';

const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!;

/**
 * Import PEM private key for signing
 */
async function importPrivateKey(pem: string) {
  const formattedPem = pem.replace(/\\n/g, '\n');

  const pemContents = formattedPem
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/**
 * Generate a JWT for GitHub App authentication
 */
async function generateAppJWT(): Promise<string> {
  const privateKey = await importPrivateKey(GITHUB_APP_PRIVATE_KEY);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(GITHUB_APP_ID)
    .setExpirationTime('10m')
    .sign(privateKey);
}

/**
 * Get or refresh installation access token
 */
export async function getInstallationToken(orgId: string): Promise<string | null> {
  const installation = await db
    .selectFrom('github_installations')
    .where('orgId', '=', orgId)
    .select(['id', 'installationId', 'accessToken', 'tokenExpiresAt'])
    .executeTakeFirst();

  if (!installation) {
    return null;
  }

  // Check if token is still valid (with 5 min buffer)
  const now = new Date();
  const expiresAt = installation.tokenExpiresAt;
  const isExpired = !expiresAt || new Date(expiresAt.getTime() - 5 * 60 * 1000) <= now;

  if (!isExpired && installation.accessToken) {
    return installation.accessToken;
  }

  // Refresh the token
  try {
    const jwt = await generateAppJWT();
    const response = await fetch(
      `https://api.github.com/app/installations/${installation.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to get installation token:', await response.text());
      return null;
    }

    const data = (await response.json()) as { token: string; expires_at: string };

    // Update token in database
    await db
      .updateTable('github_installations')
      .set({
        accessToken: data.token,
        tokenExpiresAt: new Date(data.expires_at),
        updatedAt: new Date(),
      })
      .where('id', '=', installation.id)
      .execute();

    return data.token;
  } catch (err) {
    console.error('Error refreshing installation token:', err);
    return null;
  }
}

/**
 * Get installation token by installation ID
 */
export async function getTokenByInstallationId(installationId: string): Promise<string | null> {
  const installation = await db
    .selectFrom('github_installations')
    .where('installationId', '=', installationId)
    .select(['orgId'])
    .executeTakeFirst();

  if (!installation) {
    return null;
  }

  return getInstallationToken(installation.orgId);
}
