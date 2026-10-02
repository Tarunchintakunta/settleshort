# SettleShort — UI Refactor Brief (for Grok)

> **Read this entire file before writing any code, then execute it phase by phase.**
> Your mission: take the entire SettleShort UI from "hackathon functional" to **super awesome** —
> Linear/Mercury/Stripe-grade polish — **without changing a single behavior, route, API call,
> or line of business logic.**
>
> **How to run this brief:** open the repo at `/Users/tarunchintakunta/Desktop/settleshort`
> in Grok, attach this file, and prompt:
> *"Execute UI-REFACTOR.md. Work through the phases in order. Do not ask clarifying
> questions — every decision is specified below."*

---

## 0. Operating instructions for Grok

1. **Read first, then write.** Before each phase, read the current files listed for that phase
   (start with `src/components/ui.tsx`, `src/app/globals.css`, `src/app/app/layout.tsx`).
2. **Work autonomously.** Do not stop to ask questions or present options. If a detail isn't
   specified here, choose the option closest to the Design Vision (Section 3) and keep moving.
3. **One phase at a time, in order** (Section 5). Finish a phase fully before starting the next.
4. **Verify as you go:** after each phase run `pnpm lint` and fix everything it reports.
   After the final phase run the full gates: `pnpm lint && pnpm build && pnpm test` — all green.
5. **Never edit out-of-scope files** (Section 2). If a visual improvement seems to require a logic
   change, skip it and note it in your final summary instead.
6. **Keep the diff reviewable:** `git status` / `git diff --stat` at the end must show changes only
   in UI-layer files.
7. This repo uses a non-standard Next.js 16 (see `AGENTS.md` at the repo root). Before writing
   framework code, read the guide in `node_modules/next/dist/docs/` (resolved from the repo root)
   and heed any deprecation notices.

---

## 1. What this project is

**SettleShort** — "Receipt in. Settled out. One approve."
An app that turns receipt photos, PDFs and Slack messages ("I paid $84 for dinner for @sam @rita")
into expense claims, catches duplicates, and reimburses the team through **PayPal Payouts (sandbox)** —
but only after a human admin approves the batch.

Built for the **PayPal "Build What's Next with PayPal and AI" hackathon**. The judges will run the
**demo flow**, so every screen in that flow must be pixel-perfect:

```
/  (landing)  →  Open the demo  →  /app  (dashboard)  →  /app/claims/new  (upload sample receipt)
→  /app/claims/[id]  (review claim)  →  /app/claims  (select claims)
→  /app/batches/[id]  (Approve & Pay, type APPROVE)  →  /app/activity  (audit trail)
```

### Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM + Postgres (Neon) ·
AG Grid Community (claims table) · motion/react (animation) · Phosphor icons · Anthropic/OpenAI SDKs ·
tesseract.js · Vitest. Package manager: **pnpm**.

---

## 2. Scope: what you MAY and MAY NOT touch

### ✅ In scope (this is the refactor)

- `src/app/**/page.tsx` and `src/app/**/layout.tsx` — all markup and styling
- `src/components/**` — all components
- `src/app/globals.css` — design tokens and keyframes
- `src/app/(auth)/auth-form.tsx` — **presentation only** (keep its props/behavior identical)
- `public/` images may be *referenced* differently, but do not delete or rename any file there

### 🚫 Out of scope (do not touch, do not "improve")

- `src/app/api/**` — every route handler (they return JSON; the UI must keep calling them exactly as today)
- `src/lib/**` — business logic (claims, batches, paypal, ai, matching, money, auth, seed…)
- `src/lib/db/**`, `drizzle/**`, `drizzle.config.ts` — schema and migrations
- `scripts/`, `tests/`
- `src/app/(auth)/actions.ts` — server actions for login/signup/logout/workspace creation
- `src/app/demo/route.ts`
- URL structure: **do not rename, move, or add routes**
- Data fetching: keep every query, prop shape, and `api()` call identical — redesign around them
- The `<a href="/demo">` plain-anchor pattern in `components/marketing/Nav.tsx` — the demo route
  creates a workspace and **must never be prefetched by `next/link`**

### Hard rules

1. **Behavior parity.** Every button, filter, tab, dialog, and form must keep working exactly as today.
   If a page fetched X and rendered Y, it still fetches X and renders Y — just beautifully.
2. **Dark mode must keep working.** Tokens in `globals.css` switch on `prefers-color-scheme`.
   AG Grid already reads the CSS tokens via `themeQuartz.withParams` — keep that wiring.
3. **Responsive.** The app shell collapses the sidebar to a top bar on mobile; the marketing nav has a
   `<details>` mobile menu. Every page must look intentional at 360px, 768px, and 1440px.
4. **Accessibility is a feature.** Keep `aria-*` attributes, `aria-live` regions, focus-visible rings,
   keyboard tab support in `HowItWorks`, and `prefers-reduced-motion` handling. Don't remove existing
   handling; fix any new a11y issues you introduce.
5. **Keep the honesty.** The "PayPal simulator active" banner, sandbox labels, and "no real money moves"
   copy are load-bearing for the hackathon. Restyle them, never remove them.
6. **Green gates:** `pnpm lint`, `pnpm build`, and `pnpm test` must all pass when you're done.
   (Vitest covers lib logic, not UI — don't break it, don't "fix" it.)

---

## 3. Design vision: what "super awesome" means here

SettleShort is a **settlement desk** — the auth pages already call it that. Lean into it: a calm,
precise, money-serious fintech surface. Think **Linear's restraint × Mercury's warmth × Stripe's
confidence in numbers**. Not playful, not neon — expensive-feeling.

### Principles

1. **Money is the hero.** Every page has one big number (claim total, batch total, metric). Set it large,
   tight-tracked, tabular (`tnum` exists — use it everywhere money appears). Money never wraps, never truncates.
2. **The extraction is the magic trick.** Uploading a receipt and watching fields fill with quoted
   evidence is the product's signature moment — it should feel like watching a safe being cracked,
   not a form loading. The scanline + staggered field reveal already exists; elevate it.
3. **Approve is a ceremony.** Moving money is the emotional peak. The typed-APPROVE dialog should feel
   weighty and safe — the one place in the app where friction is a feature.
4. **Status is glanceable.** Pills, confidence meters, and timeline dots carry the product's trust story.
   They must be consistent on every page (one `StatusPill`, one `Confidence`, one timeline language).
5. **Calm surfaces, decisive accents.** Neutral stone panels, hairline borders, one cobalt accent
   (`--accent`), money-green reserved for *paid/approved* states. No gradients-for-decoration,
   no competing colors.
6. **Motion with intent.** `motion/react` is installed. Use it for: extraction reveals, dialog entry,
   tab transitions, list stagger on first paint. 200–350ms, `cubic-bezier(0.16, 1, 0.3, 1)` (already the
   house easing). Everything disabled under `prefers-reduced-motion`.

### Token system (in `src/app/globals.css`)

Keep the token **names** (`--bg`, `--panel`, `--sunken`, `--ink`, `--ink-2`, `--muted`, `--line`,
`--line-strong`, `--accent`, `--accent-hover`, `--accent-soft`, `--success[-soft]`, `--warning[-soft]`,
`--danger[-soft]`, `--shadow`, `--shadow-pop`) and the `@theme inline` mappings — components reference
them as Tailwind colors (`bg-panel`, `text-muted`, `border-line`, …). You may **refine values**
(slightly deeper shadows, crisper hairlines) but don't rename or add a second accent color.
Radius system stays: **8px controls, 12px panels, full pills.**

### Typography

- Font: Geist Sans (`--font-geist-sans`), Geist Mono for numbers/IDs/code (`tnum` + `font-mono`).
- Headings: `font-semibold`, tracking `-0.02em` to `-0.035em` (already the pattern — extend it
  consistently; page titles are 26–28px, hero 42–68px).
- Body: 14–15px, `text-ink-2`; secondary text `text-muted`.
- Never use pure black/white text outside tokens; never introduce a new font.

### The `ui.tsx` primitive contract (`src/components/ui.tsx`)

These are used on **every** page. Restyle freely, but keep their **props and names** stable:
`Button` (+ `ButtonLink`) with variants `primary | secondary | approve | danger | ghost` and sizes
`sm | lg` · `Card` · `Pill` + `StatusPill` (status→tone map: draft/pending_review/matched/in_batch/paid/
failed/rejected/awaiting_approval/submitting/submitted/completed/partial + PayPal item states
NEW/PENDING/SUCCESS/UNCLAIMED/FAILED) · `Confidence` (meter + % + provider label; <55% reads warning) ·
`Money` · `Logo` · `PageHeader` (title/sub/actions) · `Empty` (icon/title/body/action) · `Field` +
`inputCls` · `Alert` (danger/success/warning). The `approve` button variant (money-green) is reserved
for the payout action — don't reuse it for generic CTAs.

---

## 4. Page-by-page brief

Read the current file listed for each route first, then apply the target.

### Marketing

**`/` — Landing** (`src/app/(marketing)/page.tsx` + `components/marketing/*`)
Sections in order: hero → problem statement → How it works (tabbed) → extraction evidence →
approval gate → PayPal API panel → FAQ → final CTA.
Current state is genuinely good copy with a strong hero. Target: tighten the type scale and rhythm
(more air between sections, consistent `h2` treatment), make the `Shot` screenshots feel like product
photography (consistent framing, soft shadows, hairline borders), polish the `HowItWorks` tab
transitions (crossfade + subtle slide, keyboard support already there — keep it), and give the final
CTA card a proper dashboard preview. Keep: sticky blur nav, mobile `<details>` menu, `DemoLink`
plain-anchor, scroll-reveal (progressive enhancement), the `PAYLOAD` code panel, FAQ `<details>`
accordion. Files: `Nav.tsx`, `Footer.tsx`, `HowItWorks.tsx`, `Shot.tsx`, `Reveal.tsx`.

**`/security`** — 8-item grid (human gate, sandbox-only, least privilege, audit, prompt-injection
mitigation, idempotency, workspace scoping, server-only secrets) + approve-dialog screenshot header.
Target: make it feel like a security whitepaper page — icon-led rows with generous whitespace, keep
the approve.png crop, keep the GitHub report link.

**`/pricing`** — Free ($0, hackathon demo) vs Team ("Not priced yet", roadmap items).
Target: the Free card should feel like the hero (shadow, slightly larger), Team muted/secondary.
Keep the honest "nothing to buy today" copy.

**`/docs`** — Judge quickstart (4 tasks) → local setup → env vars table → API overview → Zapier recipe,
with sticky TOC. Target: best-in-class docs readability — better `Pre`/`Code` styling with a
copy-button on code blocks (new, safe), clearer task numbering, sticky TOC active state.

### Auth (`src/app/(auth)/`)

**`/login`** — email + password via `AuthForm` + `login` action. Copy: "Sign in" / "Welcome back to
your settlement desk."
**`/signup`** — name + work email + password (8-char hint) via `signup` action.
**`/onboarding`** — step 1 of 2: workspace name + optional PayPal sandbox email, via
`createWorkspace` action. (Step 2 is `/app/members?welcome=1`.)
Target: give auth a split or centered-card treatment with the Logo, subtle brand side (product shot
or the tagline "Receipt in. Settled out. One approve."), consistent `Field`/`inputCls` styling,
clear error presentation from `AuthForm`. Keep layout in `(auth)/layout.tsx`; keep server-action
wiring untouched.

### App shell (`src/app/app/layout.tsx` + `components/app/sidebar.tsx`)

Sticky sidebar (244px): Logo, workspace card (initial avatar, name, role, demo tag), 6-item nav
(Overview, Claims, Batches, Activity, Members, Settings) with active pill + count badges
(pending-review count on Claims, awaiting-approval on Batches), PayPal mode + AI provider status
card, user row + sign-out. Main content renders inside a rounded panel card; a simulator banner
shows when PayPal isn't in sandbox mode.
Target: make the shell feel like a premium console — refined active states, better badge design,
status card that reads as "system health", graceful mobile (horizontal nav already — polish it).
Keep the badge counts and the simulator banner logic.

### `/app` — Overview dashboard (`src/app/app/page.tsx`)

Data: 3 metrics (Open claims, Paid this month, Extracted by AI w/ avg confidence) → awaiting-approval
batch hero cards (up to 3) → Needs review list (5) → Activity timeline (7).
Target: the awaiting-approval card is the page's hero — make it unmissable (large total, "Awaiting
your approval" treatment, hover affordance already there). Metrics row: true dashboard stat blocks.
Needs-review rows should surface *why* (possible duplicate / low confidence / waiting) more visually.
Activity timeline: refine the dot-and-rail. Keep the empty states ("Every claim has been reviewed").
Note: metrics sum mixed currencies as USD (there's a `ponytail` comment) — **do not change the
math**, it's out of scope.

### `/app/claims` — Claims inbox (`src/app/app/claims/page.tsx` + `components/claims/claims-grid.tsx`)

AG Grid table: # / Date / Vendor (+ "Possible duplicate" chip) / Amount / Paid by / Source /
Extraction (Confidence) / Status (StatusPill). Above: status filter tabs with counts (All, Needs
review, Ready, In batch, Paid, Rejected) + search. Admin selection bar (dark pill): Merge (≥2) and
"Create batch (n)" (only `matched` rows) → routes to the new batch.
Target: this is the app's workhorse — make the grid feel bespoke (row hover, selected-row tint via
`accent-soft`, refined header type, 52px rows are good). Filter tabs + search should feel like one
unified toolbar. The dark selection action bar is a nice touch — polish it. Keep AG Grid (do not
replace with a hand-rolled table); keep selection rules (only pending_review/matched selectable),
row-click → claim detail, and the "Select ready claims…" helper copy.

### `/app/claims/new` — New claim (`src/app/app/claims/new/page.tsx` + `components/claims/new-claim.tsx`)

Two tabs: **Receipt** (drag-and-drop dropzone, sample receipts: coffee $18.40 PNG, team dinner
$186.50 PNG, Uber $24 PDF) and **Message** (textarea + Slack message shortcuts, @firstname hints).
On submit → extraction theatre: source preview left (image / PDF icon / message card) with animated
scanline; step list right (Reading → Structuring → Duplicate-check) with animated progress; then
fields reveal one-by-one (Vendor, Total, Date, Tax, Tip, Card, For) each with its **quoted evidence**
line, Confidence meter, duplicate warning or "No duplicates" state, and CTAs (Review claim →
detail page, Add another).
Target: this is the demo's magic moment — make it cinematic but fast. Polish the scanline, step
transitions, and staggered field reveals (`motion/react` + `AnimatePresence` already used — refine,
don't rebuild). Error state keeps the Alert + "Try another". Keep sample files, message shortcuts,
and provider-aware step labels (`aiProvider()` → Claude/OpenAI/Local OCR).

### `/app/claims/[id]` — Claim detail (`src/app/app/claims/[id]/page.tsx` + `components/claims/claim-editor.tsx`)

Header: StatusPill + `#n from {submitter} via {source}`, vendor title, big total + "Reimburses {payer}".
Optional duplicate banner (warning panel, side-by-side this-claim vs existing, AI rationale,
link to original). Two columns: left sticky = receipt image (or PDF link / original message) +
"What was read" evidence list (quoted lines per field) + Confidence + raw-extraction-JSON
`<details>`; right = Details editor (vendor, amount, currency USD/INR/EUR/GBP, date, paid-by
[admin-only], note) with Save / Mark ready (admin, pending_review only) / Merge into original
(admin, dup only) / Reject (admin, prompt for reason); Line items + tax + tip; "Shared with" chips;
Settlement card linking to the batch with item status.
Target: the review cockpit. Evidence list should feel like an annotated receipt (quote styling is
the trust story — make it beautiful). Editor: clean two-column fields, clear primary action
(Mark ready), dangerous action (Reject) visually separated. Keep edit permissions
(`canEdit` = admin or submitter; editable only in draft/pending_review/matched) and the
low-confidence warning.

### `/app/batches` — Batch list (`src/app/app/batches/page.tsx`)

Rows: name, claim count + date + PayPal batch id, StatusPill, total. Empty state → claims.
Target: rows should read as payout summaries — stronger total, clearer status, subtle hover.
Keep the empty state and its CTA.

### `/app/batches/[id]` — Batch detail + Approve (`src/app/app/batches/[id]/page.tsx` + `components/batches/batch-actions.tsx`)

**The money page.** Header: StatusPill + PayPal-mode pill, batch name, "N claims to M people",
big total. Warnings panel (low-confidence claims, over per-payout cap, over batch cap; approve
blocked when over caps). Payouts table: Recipient (name + email) / Claim (# + vendor + confidence) /
Amount / Status (+ transaction id / error). Footer strip: PayPal batch id + sender id (or caps
reminder) + actions: Export CSV, Refresh status (when submitted/partial, polls every 2.5s ×15),
**Approve & Pay** (admin only, blocked over caps) → modal dialog: "Pay N people {total}?", typed
`APPROVE` confirmation (monospace, letterspaced input), irreversible-warning copy, Cancel / Approve.
Right rail: 4-step timeline (created → approved → sent to PayPal → paid/partial/failed).
Target: make this feel like a bank vault door. The total should be monumental. The warnings panel
must be impossible to miss. The dialog is the ceremony — perfect spacing, clear irreversibility
copy, satisfying confirm. Timeline: proper vertical stepper. Keep: all cap logic, the polling
effect, `dialog` element usage, typed-confirmation requirement, CSV export link, error banner
("claims were released, batch again").

### `/app/activity` — Audit log (`src/app/app/activity/page.tsx`)

Filter tabs (All, Claim, AI, Batch, Payout, Member, Workspace — via `?type=`) + table:
When / Actor / Action (+ raw action code) / Details (meta JSON, 3-line clamp).
Target: make it feel like a proper audit trail — monospace details, refined filter tabs.
Keep the query-param filtering and 500-row cap.

### `/app/members` — Members (`src/app/app/members/page.tsx` + `components/settings/members-client.tsx`)

Table: Name (+email) / Role / PayPal receiver (inline-editable email cell for admins, Save appears
on change). Admin-only invite form: name, email, PayPal receiver email, role (member/admin).
`?welcome=1` shows the onboarding banner ("Last step: add teammates…").
Target: clean directory feel — avatar initials, role pills, inline email editing that feels
instant. Keep the invite flow and its success message.

### `/app/settings` — Settings (`src/app/app/settings/page.tsx` + `components/settings/settings-form.tsx`)

Left: workspace name + safety caps form (Max single payout, Max batch total — "Approve is blocked
above this"). Right: Connections card (PayPal Sandbox vs simulator status; Extraction provider
status with model names) + Integrations link card.
Target: settings that read as "mission control" — clear cap semantics, connection statuses with
real status-dot language. Keep admin-only editing, PATCH to `/workspaces/settings`.

### `/app/settings/integrations` — Integrations

Two cards: Slack→SettleShort via Zapier (3-step recipe + POST code block with workspace slug and
secret header) and PayPal webhooks (URL + event list + `PAYPAL_WEBHOOK_ID` note).
Target: developer-docs polish — copy buttons on code blocks (new, safe), secret-configured pill.
Keep the env-driven values.

---

## 5. Execution phases (in order — finish one before starting the next)

1. **Foundation** — `globals.css` token refinements + `ui.tsx` primitives restyle (Button variants,
   Card, Pill/StatusPill, Confidence, PageHeader, Empty, Field/inputCls, Alert, Logo). Everything
   else inherits this. Run `pnpm lint`.
2. **Marketing** — landing page sections, then `/security`, `/pricing`, `/docs`, then `Nav`/`Footer`.
   Run `pnpm lint`.
3. **App shell** — `app/layout.tsx` sidebar, simulator banner, mobile nav. Run `pnpm lint`.
4. **Dashboard + claims inbox** — `/app`, `/app/claims` (+ AG Grid theme). Run `pnpm lint`.
5. **The magic** — `/app/claims/new` extraction theatre, `/app/claims/[id]` review cockpit.
   Run `pnpm lint`.
6. **The money** — `/app/batches`, `/app/batches/[id]` + approve dialog ceremony. Run `pnpm lint`.
7. **The rest** — `/app/activity`, `/app/members`, `/app/settings`,
   `/app/settings/integrations`, auth pages. Run `pnpm lint`.
8. **Polish pass** — empty states, skeletons (`.skeleton` exists), error states, 360px check on every
   route, dark-mode check on every route, reduced-motion check, focus-order/keyboard check.
   Then the full gates: `pnpm lint && pnpm build && pnpm test`.

After each phase, start `pnpm dev` and click through the affected pages to confirm nothing broke
visually before moving on.

---

## 6. Acceptance checklist

Before you call it done, verify:

- [ ] The full judge demo flow (Section 1) works end-to-end in `pnpm dev` with no console errors
- [ ] Every route renders at 360px / 768px / 1440px without horizontal overflow or overlap
- [ ] Light **and** dark (`prefers-color-scheme`) modes look intentional on every page
- [ ] `prefers-reduced-motion`: animations collapse to instant, content still fully visible
- [ ] Keyboard: tab order sane, dialogs usable (native `<dialog>` is fine), HowItWorks tabs
      arrow-key navigable, all icon-buttons have labels
- [ ] Every `StatusPill`, `Confidence`, `Money`, and `Empty` instance uses the shared primitives —
      no one-off status styling
- [ ] No dead or placeholder copy; every number shown is real data from the existing fetches
- [ ] `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` ✅
- [ ] `git status` / `git diff --stat` confirms the diff touches only UI-layer files — no changes to
      `src/lib/**`, `src/app/api/**`, `drizzle/**`, `scripts/**`, `tests/**`, `(auth)/actions.ts`,
      and no renamed/moved/added routes

---

## 7. File index (UI layer)

```
src/app/globals.css
src/app/layout.tsx                      # root layout (fonts, metadata)
src/app/(marketing)/layout.tsx          # marketing shell (Nav + Footer)
src/app/(marketing)/page.tsx            # landing
src/app/(marketing)/security/page.tsx
src/app/(marketing)/pricing/page.tsx
src/app/(marketing)/docs/page.tsx
src/app/(auth)/layout.tsx               # auth shell
src/app/(auth)/auth-form.tsx            # shared form (presentation-only changes)
src/app/(auth)/login/page.tsx
src/app/(auth)/signup/page.tsx
src/app/(auth)/onboarding/page.tsx
src/app/app/layout.tsx                 # app shell: sidebar, badges, status, banner
src/app/app/page.tsx                   # dashboard
src/app/app/claims/page.tsx            # inbox (server)
src/app/app/claims/new/page.tsx         # intake (server)
src/app/app/claims/[id]/page.tsx        # claim detail (server)
src/app/app/batches/page.tsx           # batch list (server)
src/app/app/batches/[id]/page.tsx       # batch detail + approve (server)
src/app/app/activity/page.tsx           # audit log (server)
src/app/app/members/page.tsx            # members (server)
src/app/app/settings/page.tsx           # settings (server)
src/app/app/settings/integrations/page.tsx
src/components/ui.tsx                  # THE primitive library — start here
src/components/app/sidebar.tsx         # SideNav
src/components/claims/claims-grid.tsx  # AG Grid inbox
src/components/claims/new-claim.tsx    # extraction theatre
src/components/claims/claim-editor.tsx # detail editor
src/components/batches/batch-actions.tsx # approve dialog + export + refresh
src/components/settings/settings-form.tsx
src/components/settings/members-client.tsx # InviteForm + PaypalEmailCell
src/components/marketing/Nav.tsx       # wrap, DemoLink (keep plain <a>!), Nav
src/components/marketing/Footer.tsx
src/components/marketing/HowItWorks.tsx
src/components/marketing/Shot.tsx
src/components/marketing/Reveal.tsx
```

Now make it super awesome. The judges should *feel* the money move.
