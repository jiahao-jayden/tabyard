import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

export const auth = betterAuth({
  database: { db: new Kysely({ dialect: new D1Dialect({ database: env.DB }) }), type: 'sqlite' },
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
    github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },
  plugins: [tanstackStartCookies()],
});
