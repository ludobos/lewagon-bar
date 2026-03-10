# Le Wagon — Bar à Papote et à Grignote
## Context for Claude Code

### The Business
- **Name**: Le Wagon — Bar à Papote et à Grignote
- **Legal entity**: SARL BOSCU
- **Address**: 22 quai de la Fosse, 44000 Nantes
- **Open**: Tuesday–Saturday
- **Instagram**: @bar.lewagon | **Web**: lewagon-nantes.com
- **Gmail**: bar.lewagon@gmail.com

### The People
- **François Rocu** (75% gérant): 20 years bartender, new entrepreneur, dyslexic.
  Keep UX dead simple. Plain French. No financial jargon. Big buttons. Mobile first.
- **Ludovic Bostral** (25% investor, tech): builds and maintains this app.

### Financial Context
- Loan: 51,000€ @ BNP, 83 months @ 4.42% → ~730€/month repayment
- Daily revenue target: 1,500–2,000€/day (use **1,750€** as default)
- Accountant: Cabinet Fiteco (Pennylane migration pending)
- Bank: BNP Nantes Graslin

### Architecture
- **Framework**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **Database**: Vercel Postgres (Neon) via `@vercel/postgres`
- **Hosting**: Vercel (cron jobs, API routes, frontend)
- **Auth**: Simple login/password via NextAuth credentials provider (admin section)
- **POS**: SumUp OAuth2 — nightly sync at 23:00 via Vercel cron
- **Invoices**: Gmail API reads bar.lewagon@gmail.com, PDFs stored in Google Drive /Factures/YYYY/MM/
- **AI**: Anthropic claude-sonnet-4-20250514 — invoice extraction + assistant

### Design System
- **Theme**: dark amber/stone (matches bar branding)
- **Font**: System sans-serif (fast on mobile)
- **Colors**: amber-500 primary, stone-950 bg, stone-800 cards, emerald-400 positive, red-400 negative
- **Layout**: max-w-lg mx-auto, bottom tab navigation on mobile
- **No complex animations**: François uses this behind the bar

### Database Tables (Vercel Postgres)
See `db/schema.sql` for full schema.
- `transactions` — SumUp sales (synced nightly)
- `invoices` — supplier invoices (from Gmail)
- `events` — contextual events (weather, Ramadan, works...)
- `oauth_tokens` — SumUp + Google refresh tokens
- `exports` — generated accounting files log
- `sync_log` — debug log for cron jobs

### VAT Rates (French bar)
- Alcool (>15°): 20%
- Soft drinks / non-alcoholic: 5.5%
- Food consumed on premises: 10%
- Takeaway food: 5.5%

### Suppliers in Gmail (invoice detection)
ABN (boissons), Promocash (food), EDF/Enedis, loyer/bail, BNP

### Key Routes
- `/admin` — protected, redirects to login if not authenticated
- `/admin/dashboard` — KPIs, chart, loan tracker
- `/admin/caisse` — transaction history + manual entry
- `/admin/factures` — invoice list + upload
- `/admin/nantes` — weather + local events feed
- `/admin/assistant` — AI chat
- `/admin/export` — generate Excel/CSV for accountant
- `/api/cron/sync-sumup` — Vercel cron, runs nightly
- `/api/cron/sync-gmail` — Vercel cron, runs every morning
- `/api/auth/[...nextauth]` — NextAuth
- `/api/sumup/connect` — start SumUp OAuth flow
- `/api/sumup/callback` — SumUp OAuth callback
- `/api/chat` — Claude assistant endpoint
- `/api/export` — generate and download Excel/CSV

### Commands
```bash
npm run dev           # local dev server
npm run build         # production build
npm run db:setup      # run schema.sql against Vercel Postgres
npm run lint          # ESLint
```

### Environment Variables
See `.env.example` — never commit `.env.local`

### Current Phase
**Phase 1 (active)**: Auth + Dashboard + Manual caisse + Export Excel/CSV
**Phase 2**: SumUp OAuth + nightly sync
**Phase 3**: Gmail invoice extraction + Drive storage
**Phase 4**: Nantes Live (météo, events, travaux) + AI assistant with full context

### Important Notes for Claude Code
- Always use `sql` from `@vercel/postgres` for DB queries
- All DB calls go in `lib/db/` — never inline SQL in components
- API routes handle all external API calls — never call SumUp/Gmail from client
- Secrets only in env vars — never hardcoded
- All user-facing text in French
- Error messages must be simple French (François reads these)
