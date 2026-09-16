# Automated private deployment setup

The `/setup` flow lets another person authorize GitHub, Supabase, and Vercel. The
installer then creates resources in accounts that person owns. Plaid remains an
optional, post-deployment connection inside their own Spend app.

## What you need to create

### 1. Provisioning Supabase project

Create one additional Supabase project owned by you. It stores only short-lived
installer sessions and encrypted provider tokens; it does not store anyone's
financial data.

1. Run `provisioning/schema.sql` in its SQL editor.
2. Copy its project URL and service-role key into Vercel as
   `SETUP_SUPABASE_URL` and `SETUP_SUPABASE_SERVICE_ROLE_KEY`.
3. Generate a 32-byte base64url encryption key and save it in Vercel as
   `PROVISIONING_ENCRYPTION_KEY`. Do not paste this key into chat or commit it.
4. Schedule `select public.delete_expired_provisioning_sessions();` daily with
   Supabase Cron if Cron is available on the project. The two-hour session expiry
   is enforced even without the cleanup schedule.

### 2. GitHub App

Create a GitHub App in GitHub Developer settings. Use:

- Homepage URL: `https://spending-tracker-bice-omega.vercel.app/setup`
- Callback URL: `https://spending-tracker-bice-omega.vercel.app/api/setup/oauth/github/callback`
- Setup URL: `https://spending-tracker-bice-omega.vercel.app/setup`
- User authorization callback enabled

Request only repository creation/template permissions needed by the app. Start
with repository `Administration: write`, `Contents: write`, and `Metadata: read`.
Install the app on your account for testing. Save its client ID and client secret
in Vercel as `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`.

Mark the source GitHub repository as a **template repository** in its GitHub
settings. Set `GITHUB_TEMPLATE_OWNER` and `GITHUB_TEMPLATE_REPO` in Vercel.

### 3. Supabase OAuth application

Create an OAuth application in the Supabase partner/developer settings with:

- App URL: `https://spending-tracker-bice-omega.vercel.app/setup`
- Callback URL: `https://spending-tracker-bice-omega.vercel.app/api/setup/oauth/supabase/callback`

Request the smallest scopes that allow listing organizations and creating and
configuring projects. Save the client ID and secret in Vercel as
`SUPABASE_OAUTH_CLIENT_ID` and `SUPABASE_OAUTH_CLIENT_SECRET`.

### 4. Vercel integration

Create a Vercel integration with installation/callback URL:

`https://spending-tracker-bice-omega.vercel.app/api/setup/oauth/vercel/callback`

It needs permission to create projects and deployments and to write project
environment variables. Save its slug, client ID, and secret as
`VERCEL_INTEGRATION_SLUG`, `VERCEL_INTEGRATION_CLIENT_ID`, and
`VERCEL_INTEGRATION_CLIENT_SECRET`.

### 5. Shared server configuration

Add this production variable in Vercel:

`SETUP_BASE_URL=https://spending-tracker-bice-omega.vercel.app`

Apply every server-only value to Production and Preview only when the preview
uses matching provider callback URLs. Redeploy after adding them.

## Security boundaries

- Provider secrets and OAuth tokens exist only in Vercel server functions and
  the provisioning database.
- The service-role key and encryption key must never use a `VITE_` prefix.
- Browser cookies contain a random session secret, are HttpOnly, SameSite=Lax,
  Secure in production, and expire after two hours.
- Plaid client secrets and access tokens are configured directly in each user's
  Supabase project. The installer does not receive them.
- Successful provisioning must delete OAuth tokens. Failed and abandoned rows
  are removed by the expiry cleanup.
