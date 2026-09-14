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

## Commands

- `npm run dev` — local development
- `npm run build` — type-check and create a production build
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build
