import { betterAuth } from 'better-auth';
import { db } from '../db/client';
import { createPersonalOrg } from './hooks';

export const auth = betterAuth({
  basePath: '/auth',

  database: {
    db,
    type: 'postgres',
  },

  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ['user:email', 'read:org'],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 24 hours
  },

  user: {
    additionalFields: {
      githubId: { type: 'string', required: false },
      githubUsername: { type: 'string', required: false },
      plan: { type: 'string', defaultValue: 'free' },
      stripeCustomerId: { type: 'string', required: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create personal org for new users
          await createPersonalOrg(user.id, user.name, user.email);
        },
      },
    },
  },

  trustedOrigins: [process.env.SITE_URL || 'http://localhost:3000'],
});

export type Auth = typeof auth;
