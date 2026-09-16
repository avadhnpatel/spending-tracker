# Spend for iOS

Spend uses Capacitor so the React interface is bundled inside a native iOS app. The app keeps
each person's private Supabase project as runtime configuration instead of building that project
URL or key into the binary.

## One-time Mac requirements

Install the full **Xcode** app from the Mac App Store, launch it once, accept its licence, and
install its iOS platform components. Command Line Tools alone are not enough.

Then install CocoaPods:

```sh
brew install cocoapods
```

From this repository, generate the iOS project:

```sh
npx cap add ios
npm run ios:sync
npm run ios:open
```

In Xcode, choose a signing team, connect an iPhone, select that device, and run the app.

## Required iOS configuration

After `npx cap add ios`, add the `spend` URL scheme to the target's URL Types in Xcode:

- Identifier: `app.spend.tracker`
- URL Schemes: `spend`

This supports both:

- `spend://auth/callback` for Supabase magic-link sign-in
- `spend://setup/complete` for the private GitHub/Supabase/Vercel setup handoff

For the production release, also register the app's associated domain and replace the setup
handoff with a Universal Link. The custom scheme is retained as a development fallback.

## Private-backend onboarding

The native app opens the existing Vercel setup portal in the system browser. The portal still
uses GitHub, Supabase, and Vercel OAuth exactly as the web flow does.

The app creates a two-hour setup session with two separate credentials:

1. A browser handoff token, used once to give the system browser its setup cookie.
2. A device claim code, kept in Capacitor Preferences and never placed in the browser URL.

When setup completes, the portal opens `spend://setup/complete?session=<id>`. The native app
exchanges the session ID and its claim code for only the private Supabase URL, publishable key,
and deployed web URL. Provider tokens, service-role keys, and Plaid secrets stay server-side.

## Supabase configuration

New private projects receive `spend://auth/callback` automatically through the provisioning
service. For an existing Supabase project used in an iOS build, add this exact redirect URL in
**Authentication → URL Configuration → Redirect URLs**.

## Validation checklist

Run this on a physical iPhone before TestFlight:

- Start private setup from an unconfigured app.
- Complete GitHub, Supabase, and Vercel OAuth in the system browser.
- Confirm the app returns to its email sign-in screen using the newly created private backend.
- Request a magic link and verify Mail returns to Spend.
- Create and edit a transaction, switch trackers, import a CSV, and connect/test Plaid.
- Verify sign-out and a cold app launch retain the correct private backend.
