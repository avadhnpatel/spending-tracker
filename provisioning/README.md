# Automated private deployment setup

The `/setup` flow lets another person authorize GitHub, Supabase, and Vercel. The
installer then creates resources in accounts that person owns. Plaid remains an
optional, post-deployment connection inside their own Spend app.

## What you need to create

### 1. Provisioning Supabase project

Create one additional Supabase project owned by you. It stores only short-lived
installer sessions and encrypted provider tokens; it does not store anyone's
financial data.

1. Run `provisioning/schema.sql` in the project’s SQL Editor. If you already ran an older version, run it again: its `alter table ... add column if not exists` statements safely add the mobile-onboarding fields. The `Success. No rows returned` message means it completed correctly.
2. In the same Supabase project, open the **Connect** button in the top navigation. Copy the Project URL shown there. It has the form `https://<project-ref>.supabase.co`.
3. Open **Settings** (the gear at the lower left) → **API Keys**. Under the **Secret keys** section, create a secret key if one does not exist, then copy it. Supabase has renamed the old `service_role` key to a secret key; either elevated server key works with this installer. Never copy the publishable key for this field.
4. Keep the URL and secret key open only long enough to add them to Vercel using the steps below. Do not put either value in GitHub, `.env` files that are committed, or chat.
5. Generate a 32-byte base64url encryption key and save it in Vercel as
   `PROVISIONING_ENCRYPTION_KEY`. One safe way to generate it locally is:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

6. Schedule `select public.delete_expired_provisioning_sessions();` daily with
   Supabase Cron if Cron is available on the project. The two-hour session expiry
   is enforced even without the cleanup schedule.

### Add those values to Vercel now

1. Open [Vercel](https://vercel.com/dashboard), select the existing **spending-tracker** project, then choose **Settings** → **Environment Variables**.
2. Click **Add New**. Add the following one at a time. Choose **Production** for every value. You can also select **Preview** later, after registering matching preview callback URLs.

   | Name | Value to paste |
   | --- | --- |
   | `SETUP_BASE_URL` | `https://spendingtrkr.com` |
   | `SETUP_SUPABASE_URL` | The Project URL from the new `spend-provisioning` Supabase project |
   | `SETUP_SUPABASE_SERVICE_ROLE_KEY` | The **secret key** from that new project’s Settings → API Keys page |
   | `PROVISIONING_ENCRYPTION_KEY` | The output of the local command above |

3. Mark the last two as sensitive if Vercel offers that option. The names must match exactly and none may begin with `VITE_`.
4. Click **Save** after each variable. Vercel applies variables only to new deployments, so use the **Deployments** tab to redeploy `main` after all four have been saved.

### 2. GitHub OAuth App

Create a standard OAuth App under the `avadhnpatel` GitHub account. Do not create
a GitHub App: GitHub Apps require each user to install the app separately, while
this installer is designed around a single OAuth authorization. Use:

- Application name: `Spend Private Setup`
- Homepage URL: `https://spendingtrkr.com/setup`
- Authorization callback URL: `https://spendingtrkr.com/api/setup/oauth/github/callback`

In GitHub, click your avatar → **Settings** → **Developer settings** → **OAuth
Apps** → **New OAuth App** and enter those values. OAuth Apps do not have a
repository-permissions form. Spend requests the `repo` scope when authorization
starts; GitHub displays that access on its consent screen. That scope is required
to create the private repository and let provisioning read it for deployment.
It also grants broad access to the user's other private repositories, so the UI
discloses this before authorization. Spend encrypts the token while setup is in
progress and deletes it after provisioning completes.

After creating the OAuth App, generate a client secret. In Vercel, add
`GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` using the OAuth App's
client ID and client secret. Mark the secret sensitive. Remove the obsolete
`GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` variables so a GitHub App
cannot be wired in accidentally. Redeploy after saving the new values.

Keep the source GitHub repository **public** and mark it as a **template
repository** in its GitHub settings. Set `GITHUB_TEMPLATE_OWNER=avadhnpatel` and
`GITHUB_TEMPLATE_REPO=spending-tracker` in Vercel (or use the actual public
template repository name if it differs).

### 3. Supabase OAuth application

This lives in your **Supabase organization settings**, not in an individual project and not in a separate partner portal.

1. In Supabase, click your organization name in the top-left project switcher (for example, `avadhnpatel's Org`).
2. Choose **Organization settings**.
3. Open the **OAuth Apps** tab.
4. Click **Add application**.
5. Use a clear name such as `Spend Private Setup` and enter:
   - App URL: `https://spendingtrkr.com/setup`
   - Redirect URI: `https://spendingtrkr.com/api/setup/oauth/supabase/callback`
6. The current dashboard does not show a separate client-type setting. That is expected; the client secret it generates is used only by our Vercel server function.
7. Select only the scopes needed for automated project setup: Organizations (read), Projects (read/write), Database (write), Auth (write), Edge Functions (write), Secrets (read/write), and Storage (write). Leave the other scopes at **No access**.
8. Click **Create** and immediately copy the client ID and client secret. The secret may only be shown once.
9. In Vercel → **spending-tracker** → **Settings** → **Environment Variables**, add `SUPABASE_OAUTH_CLIENT_ID` and `SUPABASE_OAUTH_CLIENT_SECRET`. Mark the secret sensitive and redeploy after saving.

If **OAuth Apps** is not visible in Organization settings, stop there and send a screenshot. It means the feature is not enabled for that organization or its UI has changed; do not confuse it with **Authentication → OAuth Apps**, which configures your individual project to act as an identity provider and is not what this installer needs.

### 4. Vercel integration

This is separate from the **Integrations** page inside the spending-tracker project. Open the Vercel dashboard, select your account in the team switcher, click **Integrations**, then click **Integrations Console** in the top-right and choose **Create**. Select a **connectable account integration**; do not create a Native integration or a Marketplace product.

Use these values in the form:

- Name: `Spend Private Setup`
- URL slug: `spend-private-setup` (or a unique variation if already taken)
- Website: `https://spendingtrkr.com/setup`
- Documentation URL: `https://spendingtrkr.com/setup`
- Privacy policy URL: `https://spendingtrkr.com/privacy`
- Terms/EULA URL: `https://spendingtrkr.com/terms`
- Redirect URL: `https://spendingtrkr.com/api/setup/oauth/vercel/callback`
- Configuration URL: `https://spendingtrkr.com/setup`
- Webhook URL: leave blank

For API scopes, select only: `user` (read), `team` (read), `project` (read/write), `project-env-vars` (read/write), `deployment` (read/write), and `integration-configuration` (read/write). Do not request domains, billing, logs, Edge Config, or global project environment variables.

The Redirect URL is the installer endpoint. Vercel sends a short-lived code there after a friend approves the integration; our server exchanges it for a token and then creates their project and deployment.

Vercel's external installation page intentionally requires the user to click
**Add Integration**, choose the Vercel account and project scope, and then click
**Install** after signing in. Login alone does not authorize the integration.
Spend opens this page in a separate tab and explains those steps in the setup UI;
after **Install**, Vercel calls the configured Redirect URL and Spend resumes the
same setup session automatically.

After the integration is created, open its settings in the Integration Console. At the bottom, under **Credentials**, copy the client ID and client secret. Its URL slug is the value entered above.

In Vercel → **spending-tracker** → **Settings** → **Environment Variables**, add `VERCEL_INTEGRATION_SLUG`, `VERCEL_INTEGRATION_CLIENT_ID`, and `VERCEL_INTEGRATION_CLIENT_SECRET`; mark the secret sensitive and redeploy after saving.

### 5. Shared server configuration

`SETUP_BASE_URL` must be `https://spendingtrkr.com` in production. GitHub,
Supabase, and Vercel all return to callback routes on that same public domain;
never use a `*.vercel.app` deployment URL, because Deployment Protection can
intercept it before the callback reaches Spend. Apply every provider value to
Production and Preview only when the preview uses matching provider callback
URLs. Redeploy after adding them.

### 6. Account gateway and returning users

The public `spendingtrkr.com` deployment is the private-app installer, never a
shared financial-data app. A verified email automatically starts the GitHub,
Supabase, and Vercel connection flow for a new user; returning users are sent
straight to their existing private deployment. The provisioning Supabase
project stores only the verified-email directory (`private_apps`), never
transactions or Plaid credentials.

1. Run the latest `provisioning/schema.sql` in the provisioning project's SQL
   editor. This adds the durable `private_apps` directory and owner columns to
   setup sessions.
2. In that provisioning project's **Authentication → URL Configuration**, add
   `https://spendingtrkr.com/account/callback` (and the temporary Vercel URL
   while testing) to Redirect URLs. Ensure Email authentication is enabled.
3. Add these public variables to the gateway Vercel deployment and redeploy:
   `VITE_DIRECTORY_SUPABASE_URL` and
   `VITE_DIRECTORY_SUPABASE_PUBLISHABLE_KEY`. Their values are the provisioning
   project URL and its **publishable** key. Do not use the service-role key.

After an email link is verified, the gateway finds the user's private app in
the directory and redirects web visitors to it. A native device receives the
private project's runtime configuration only after the same verified directory
session completes setup. Existing deployed private apps created before this
directory feature must be added to `private_apps` once (or run a recovery flow)
before they can be discovered on a new device.

When creating the private Supabase project, the installer sends exactly one
`region_selection` smart group. The user can choose Americas, EMEA, or Asia
Pacific; older clients that omit the field safely default to Americas. Do not
send the deprecated `region` field together with `region_selection`, because
the Supabase Management API rejects requests containing both.

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
- iOS onboarding uses a one-time browser handoff token plus a separate device
  claim code. The browser never receives the claim code, and the native app
  receives only its Supabase URL, publishable key, and deployed web URL.

## Test the completed installer

After all environment variables are saved and the latest `main` deployment is ready, open `/setup` in a private browser window. Connect the three services, create a test repository, choose a Supabase organization, and press **Create my private app**. The flow is restartable: if a newly created Supabase project is still booting, wait about a minute and press **Resume setup**. A successful run ends with a link to the new Vercel app and removes the temporary provider tokens from the provisioning database.
