# Private Supabase provisioning

Spend uses one centrally deployed web app and a separate Supabase project for each
user. The shared deployment contains no financial data. A verified directory account
maps the user to the URL and publishable key for the Supabase project they own.

The `/setup` flow asks for Supabase authorization only. It creates the project, applies
`supabase/schema.sql`, deploys the three Plaid Edge Functions, configures Auth callback
URLs, records the user-to-project mapping, and deletes the temporary OAuth token.
GitHub and Vercel authorization are deliberately not part of user onboarding.

## Control-plane Supabase project

Create one Supabase project owned by the Spend operator and run
`provisioning/schema.sql` in its SQL editor. It stores verified directory accounts,
short-lived provisioning sessions, encrypted OAuth tokens, and private-project
mappings. It never stores transactions, receipts, or Plaid credentials.

In the control-plane project's Authentication settings:

- Enable email authentication.
- Add `https://spendingtrkr.com/account/callback` as a redirect URL.
- Optionally schedule `select public.delete_expired_provisioning_sessions();` daily.

## Supabase OAuth application

Create an OAuth application in the operator's Supabase organization settings:

- App URL: `https://spendingtrkr.com/setup`
- Redirect URI: `https://spendingtrkr.com/api/setup/oauth/supabase/callback`
- Required access: Organizations read; Projects read/write; Database write; Auth
  write; Edge Functions write; Secrets read/write; Storage write.

Save its client ID and secret only in the central Vercel project.

## Central Vercel deployment

The existing `spendingtrkr.com` Vercel project hosts both the static app shell and the
server-side setup endpoints. Configure these Production environment variables:

- `SETUP_BASE_URL=https://spendingtrkr.com`
- `SETUP_SUPABASE_URL`: control-plane project URL
- `SETUP_SUPABASE_SERVICE_ROLE_KEY`: control-plane secret/service-role key
- `PROVISIONING_ENCRYPTION_KEY`: a 32-byte base64url key
- `SUPABASE_OAUTH_CLIENT_ID`
- `SUPABASE_OAUTH_CLIENT_SECRET`
- `VITE_DIRECTORY_SUPABASE_URL`: control-plane project URL
- `VITE_DIRECTORY_SUPABASE_PUBLISHABLE_KEY`: control-plane publishable key

Generate the encryption key locally with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`SETUP_SUPABASE_SERVICE_ROLE_KEY`, `PROVISIONING_ENCRYPTION_KEY`, and the OAuth client
secret must never have a `VITE_` prefix. Redeploy after changing environment variables.
The old GitHub OAuth and Vercel Integration variables are no longer used and can be
removed after this version is live.

## Runtime and retry behavior

After directory authentication, `/api/directory/me` returns only the user's Supabase
project reference and publishable key. The browser stores that public configuration
locally and reloads the shared shell against the user's project. Supabase row-level
security remains the data boundary.

Provisioning runs one external mutation per request. Each step has an optimistic lease,
so duplicate browser requests cannot run the same step concurrently. A stopped request
can be resumed after the lease expires. Project names include a deterministic session
suffix, allowing an interrupted project-creation response to recover the already-created
project instead of creating another one. Schema and function deployments are idempotent.

## Validation

Open `https://spendingtrkr.com/account` in a private browser window, verify an email,
connect Supabase, choose an organization and region, and start setup. A completed setup
returns to `/account`, writes the user's public runtime configuration, and opens `/login`
on the shared domain. Confirm that:

- no GitHub or Vercel authorization is requested;
- the new Supabase project contains the schema and all three Edge Functions;
- the control-plane `private_apps` row points to that project;
- the provisioning session is `complete` and its provider tokens are null;
- signing in at `/login` creates a session in the user's Supabase project.
