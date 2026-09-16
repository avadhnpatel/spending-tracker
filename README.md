# Spend

A mobile-first personal spending tracker. Each month, trip, or project can have its own
tracker with separate transactions, categories, recurring items, receipts, and reports.

## Stack

- Vite, React, TypeScript, and Tailwind CSS
- Supabase Auth, Postgres, and Storage
- Vercel hosting
- Recharts
- Installable PWA

## Local setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` and add the project URL and publishable/anon key.
4. In Supabase Authentication URL Configuration, add:
   - `http://localhost:5173/auth/callback`
   - the eventual Vercel URL ending in `/auth/callback`

The browser client uses Supabase's implicit auth flow so email magic links can be opened from
an email app or browser other than the one that requested the link.
5. Install dependencies with `npm install`.
6. Start development with `npm run dev`.

The app uses email magic links. Receipt images are compressed in the browser to target
700 KB before upload. Database rows and receipt files are protected by Supabase row-level
security and storage policies.

## Deploy to Vercel

Import this git repository as a Vite project. Add these environment variables for
Production, Preview, and Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The Vercel Supabase integration is also supported directly through
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

After the first deployment, add the exact Vercel callback URL to Supabase Authentication
URL Configuration, then redeploy if the domain or environment variables changed.

## Automated private copies

The public `/setup` page is the start of a guided installer for friends. It connects
GitHub, creates a private repository from this template, and connects the user's own
Supabase and Vercel accounts. Their financial data and free-tier limits belong to
their projects rather than this app's Supabase project.

The installer uses a separate, server-only provisioning database. See
[`provisioning/README.md`](provisioning/README.md) for provider registration,
callback URLs, environment variables, and security boundaries.

## iOS app

Spend can be packaged as an iOS app with Capacitor. The native app uses the same private
GitHub/Supabase/Vercel onboarding flow and stores only the selected Supabase URL and publishable
key on the device. See [`IOS_SETUP.md`](IOS_SETUP.md) for Mac requirements, iOS URL-scheme setup,
and the physical-device validation checklist.

## Commands

- `npm run dev` — local development
- `npm run build` — type-check and create a production build
- `npm run check:api` — type-check Vercel server functions
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build
- `npm run ios:sync` — build the web app and sync it into the iOS project
- `npm run ios:open` — open the iOS project in Xcode
