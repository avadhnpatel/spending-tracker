# Plaid setup

The frontend never receives Plaid secrets or Plaid access tokens. `PLAID_CLIENT_ID` and
`PLAID_SECRET` are Supabase Edge Function secrets. Per-user access tokens are stored in
`financial_connections`, which has RLS enabled and no client policies.

## Plaid Dashboard

1. Start the free Trial plan and enable Transactions.
2. Add this redirect URI to the Plaid application:
   `https://spending-tracker-bice-omega.vercel.app/more/import`
3. Copy the Client ID and Production secret from Developers → Keys.

## Supabase secrets

Set these Edge Function secrets without adding them to `.env` or Vercel:

```sh
npx supabase secrets set \
  PLAID_CLIENT_ID=... \
  PLAID_SECRET=... \
  PLAID_ENV=production \
  PLAID_REDIRECT_URI=https://spending-tracker-bice-omega.vercel.app/more/import \
  PLAID_CRON_SECRET=use-a-long-random-value \
  --project-ref xbdnhcehyfxbqwloctmt
```

Deploy the functions:

```sh
npx supabase functions deploy plaid-link-token --project-ref xbdnhcehyfxbqwloctmt
npx supabase functions deploy plaid-exchange --project-ref xbdnhcehyfxbqwloctmt
npx supabase functions deploy plaid-sync --project-ref xbdnhcehyfxbqwloctmt --no-verify-jwt
```

`plaid-sync` accepts either a signed-in user's JWT or the `x-cron-secret` header. Configure
a Supabase scheduled Edge Function invocation every six hours with that header to keep all
active connections updated. Users can also run Sync now from the import screen.
