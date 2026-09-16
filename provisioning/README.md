# Automated private deployment setup

The `/setup` flow lets another person authorize GitHub, Supabase, and Vercel. The
installer then creates resources in accounts that person owns. Plaid remains an
optional, post-deployment connection inside their own Spend app.

## What you need to create

### 1. Provisioning Supabase project

Create one additional Supabase project owned by you. It stores only short-lived
installer sessions and encrypted provider tokens; it does not store anyone's
financial data.

1. Run `provisioning/schema.sql` in the project’s SQL Editor. The `Success. No rows returned` message means it completed correctly.
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
   | `SETUP_BASE_URL` | `https://spending-tracker-bice-omega.vercel.app` |
   | `SETUP_SUPABASE_URL` | The Project URL from the new `spend-provisioning` Supabase project |
   | `SETUP_SUPABASE_SERVICE_ROLE_KEY` | The **secret key** from that new project’s Settings → API Keys page |
   | `PROVISIONING_ENCRYPTION_KEY` | The output of the local command above |

3. Mark the last two as sensitive if Vercel offers that option. The names must match exactly and none may begin with `VITE_`.
4. Click **Save** after each variable. Vercel applies variables only to new deployments, so use the **Deployments** tab to redeploy `main` after all four have been saved.

### 2. GitHub App

Create a GitHub App in GitHub Developer settings. Use:

- Homepage URL: `https://spending-tracker-bice-omega.vercel.app/setup`
- Callback URL: `https://spending-tracker-bice-omega.vercel.app/api/setup/oauth/github/callback`

In GitHub, click your avatar → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**. Enter the homepage URL and repository permissions above, then create the app. The **Callback URL** may appear only after the app has been created: open the new app’s settings page, find **Identifying and authorizing users**, and enter the callback URL there. Do not enable **Request user authorization (OAuth) during installation** and leave **Setup URL** blank. Spend explicitly starts the OAuth flow when someone presses **Connect GitHub**, so it only needs the callback URL. You do not need webhooks for this installer.

In Vercel, add `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` with the client ID and newly generated client secret. Mark the secret sensitive.

Mark the source GitHub repository as a **template repository** in its GitHub
settings. Set `GITHUB_TEMPLATE_OWNER` and `GITHUB_TEMPLATE_REPO` in Vercel.

### 3. Supabase OAuth application

This lives in your **Supabase organization settings**, not in an individual project and not in a separate partner portal.

1. In Supabase, click your organization name in the top-left project switcher (for example, `avadhnpatel's Org`).
2. Choose **Organization settings**.
3. Open the **OAuth Apps** tab.
4. Click **Add application**.
5. Use a clear name such as `Spend Private Setup` and enter:
   - App URL: `https://spending-tracker-bice-omega.vercel.app/setup`
   - Redirect URI: `https://spending-tracker-bice-omega.vercel.app/api/setup/oauth/supabase/callback`
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
- Website: `https://spending-tracker-bice-omega.vercel.app/setup`
- Documentation URL: `https://spending-tracker-bice-omega.vercel.app/setup`
- Privacy policy URL: `https://spending-tracker-bice-omega.vercel.app/privacy`
- Terms/EULA URL: `https://spending-tracker-bice-omega.vercel.app/terms`
- Redirect URL: `https://spending-tracker-bice-omega.vercel.app/api/setup/oauth/vercel/callback`
- Configuration URL: `https://spending-tracker-bice-omega.vercel.app/setup`
- Webhook URL: leave blank

For API scopes, select only: `user` (read), `team` (read), `project` (read/write), `project-env-vars` (read/write), `deployment` (read/write), and `integration-configuration` (read/write). Do not request domains, billing, logs, Edge Config, or global project environment variables.

The Redirect URL is the installer endpoint. Vercel sends a short-lived code there after a friend approves the integration; our server exchanges it for a token and then creates their project and deployment.

After the integration is created, open its settings in the Integration Console. At the bottom, under **Credentials**, copy the client ID and client secret. Its URL slug is the value entered above.

In Vercel → **spending-tracker** → **Settings** → **Environment Variables**, add `VERCEL_INTEGRATION_SLUG`, `VERCEL_INTEGRATION_CLIENT_ID`, and `VERCEL_INTEGRATION_CLIENT_SECRET`; mark the secret sensitive and redeploy after saving.

### 5. Shared server configuration

`SETUP_BASE_URL` is already covered in the first Vercel step above. Apply every provider value to Production and Preview only when the preview
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
