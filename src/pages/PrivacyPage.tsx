export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" updated="September 16, 2026">
      <p>Spend is a personal spending tracker. This policy explains the information used by the public app and its private-copy setup flow.</p>
      <h2>Information stored in your Spend app</h2>
      <p>Your account email, trackers, transactions, categories, recurring items, and imported transaction records are stored in the Supabase project connected to your copy of Spend. If you create a private copy through the setup flow, that Supabase project belongs to you.</p>
      <h2>Bank connections</h2>
      <p>If you choose to connect a bank through Plaid, bank credentials are entered in Plaid’s interface. Spend does not receive or store bank passwords. Plaid access tokens are stored only in the Supabase project that belongs to the person who connected the account.</p>
      <h2>Private-copy setup</h2>
      <p>The setup flow temporarily processes authorization tokens from GitHub, Supabase, and Vercel to create a private repository and deployment. Those tokens are encrypted, expire after two hours, and are deleted after provisioning. The installer does not collect Plaid credentials.</p>
      <h2>Sharing</h2>
      <p>Spend does not sell personal information. Financial records are not shared with other Spend users. Service providers such as GitHub, Supabase, Vercel, and Plaid process information according to the accounts and permissions you authorize.</p>
      <h2>Contact</h2>
      <p>For questions about this policy, contact the Spend project owner through the repository that hosts your copy of the app.</p>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of use" updated="September 16, 2026">
      <p>Spend is a personal expense-tracking tool provided as software. It is not a bank, financial adviser, accountant, tax adviser, or payment service.</p>
      <h2>Your responsibility</h2>
      <p>You are responsible for reviewing imported transactions, keeping your account credentials secure, and deciding how to use financial information shown by the app. Spend may display incomplete, delayed, duplicated, or incorrectly categorized transaction information.</p>
      <h2>Your accounts and data</h2>
      <p>When you create a private copy, you control its GitHub repository, Vercel project, Supabase project, and any Plaid account you connect. You are responsible for the terms, billing, and security settings of those services.</p>
      <h2>No warranty</h2>
      <p>The software is provided as available. Do not rely on it as the sole record of your finances or as a substitute for professional advice.</p>
      <h2>Changes</h2>
      <p>These terms may change as the software evolves. Continuing to use the app after a change means you accept the updated terms.</p>
    </LegalLayout>
  )
}

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))] sm:px-8">
      <a href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800">← Spend</a>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated {updated}</p>
      <article className="mt-8 space-y-6 rounded-3xl bg-white p-6 leading-7 text-stone-700 shadow-sm [&_h2]:pt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-stone-900">
        {children}
      </article>
    </main>
  )
}
