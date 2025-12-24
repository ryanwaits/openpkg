import { createAuth } from '@doccov/auth';
import { db } from './db';

export const auth = createAuth({
  db,
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
});
