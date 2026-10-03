# SETTLESHORT — MASTER PROMPT: End-to-End UI Overhaul

> **For Grok.** This is the single driver for the refactor — it supersedes UI-REFACTOR.md.
> Open the repo at `/Users/tarunchintakunta/Desktop/settleshort`, attach this file, and paste:
> *"Execute MASTER-PROMPT.md end to end. Do not ask questions — every decision is specified."*

---

## 1. Mission

You are a senior product designer + frontend engineer. SettleShort's UI was reviewed page-by-page
on the live deployment (https://settleshort.vercel.app/). The verdict: the design system is ~70%
there, but specific, fixable flaws make the whole product look cheap — most critically, **every money
amount on the site renders broken** ("$287 . 55" with a wide gap around the decimal point).

Your job: an end-to-end UI overhaul of all 17 routes that fixes every issue in Section 3, elevates
the design to Linear/Mercury/Stripe-grade fintech polish, and changes **zero behavior, zero routes,
zero API calls, zero business logic.**

---

## 2. Product context

**SettleShort** — "Receipt in. Settled out. One approve." Receipt photos, PDFs, and Slack messages
become expense claims via AI extraction with quoted evidence; duplicates get caught; an admin
approves a batch and money moves through **PayPal Payouts (sandbox)**.

Built for the **PayPal "Build What's Next with PayPal and AI" hackathon**. The judges run this demo
flow — every screen in it must be flawless:

```
/  →  Open the demo  →  /app  →  /app/claims/new (sample receipt)  →  /app/claims/[id]
→  /app/claims  →  /app/batches/[id] (Approve & Pay, type APPROVE)  →  /app/activity
```

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM + Postgres
(Neon) · AG Grid Community (claims table) · motion/react · Phosphor icons · pnpm.

**Warning:** this repo uses a non-standard Next.js 16 (see `AGENTS.md` at the repo root). Before
writing framework code, read the guide in `node_modules/next/dist/docs/` (resolved from the repo
root) and heed any deprecation notices.

---

## 3. Evidence — what the live-site review found (fix all of it)

### P0 — fix first; these make the product look broken

**1. Money typography is broken everywhere.** Every amount renders with a wide gap around the
decimal point — "$287 . 55", "$215 . 99", "$64 . 00" — on the dashboard, claims inbox, claim
detail header, batch pages, and the Approve dialog. It reads as a bug and makes the whole app look
cheap. The root cause is in the money rendering path (the `Money` primitive in
`src/components/ui.tsx` and/or global letter-spacing applied to numerals).
**Fix:** amounts must render as tight, professional tabular numerals — "$287.55" — everywhere, at
every size, in both themes. Audit every place money appears. No letter-spacing on numerals;
proper `font-variant-numeric: tabular-nums`; verify the decimal point has no extra side gap.

**2. Claims inbox table overflows its card.** On `/app/claims` the AG Grid table is wider than its
container: the STATUS column — the most important column — is clipped ("Needs revi…") and the page
gains a horizontal scrollbar. **Fix:** the product's core table must fit its card at 1440px with no
horizontal scroll. Tighten column widths, let the grid flex, reduce cell padding, abbreviate where
sensible — but keep every column. Do not replace AG Grid with a hand-rolled table.

**3. Auth pages look buggy on first impression.** On `/login` and `/signup`, the left brand panel's
dashboard mockup is cropped mid-content — a "New claim" button sliced in half at the panel
boundary. It reads as a rendering bug, and it's the first thing a new user sees. **Fix:** rebuild
the auth visual — either a properly composed mockup with safe padding from all edges, or a clean
brand treatment (logo, tagline "Receipt in. Settled out. One approve.", subtle pattern). Never clip
interactive-looking elements.

### P1 — high visibility

**4. Receipt upload flow strands the user.** On `/app/claims/new`, the receipt tab's sample flow can
fail with a raw developer error ("S3 not configured") — red alert, greyed-out steps, dead end with
only "Try another". Two rules: **(a)** never surface raw developer errors — every failure state
gets human-friendly copy ("We couldn't process that receipt") plus a clear recovery path (retry,
try a sample, switch to message input); **(b)** the extraction trigger must be unmistakable — one
click on a sample starts extraction immediately with visible progress. No dead clicks, no hidden
second step.

**5. Landing page polish gaps** (`/`):
- **(a)** FAQ rows have no click affordance — only a tiny chevron toggles them. Make the whole row
  clickable with a hover state.
- **(b)** Pricing cards are mismatched — the Free card is tall with a heavy shadow, Team is short
  and flat, reading as lopsided rather than deliberate. Equalize with intentional hierarchy
  (Free as the hero, Team muted but finished).
- **(c)** The CTA card's dashboard preview is scaled to unreadable noise — show it at a legible
  size or replace it with a proper product shot.
- **(d)** The hero has a large dead-whitespace band between the CTAs and the mockup — tighten the
  rhythm so the page keeps momentum.
- **(e)** Footer columns are uneven ("How it works"/"Docs" stacked in one column) — balance them.

**6. Dashboard weaknesses** (`/app`):
- **(a)** The "Extracted by AI" metric tile has no headline number (its siblings do) — it looks like
  a failed render. Give it a real headline stat from the existing data.
- **(b)** Confidence bars in "Needs review" float in a dead zone between label and amount — the
  row's middle third is wasted. Restructure the row so label, signal (confidence / duplicate),
  and amount read in one scan.
- **(c)** Sidebar badge counts are tiny, low-contrast orange pills — make them legible.
- **(d)** Microcopy: "One decision is waiting on you." reads awkwardly — tighten microcopy across
  the dashboard. (Do not change what the numbers mean — the mixed-currency metric math is
  out of scope.)

### P2 — fit and finish

**7. New-claim message flow wording.** The progress step says "Reading the message with Local OCR"
— it's text parsing, not OCR. Label steps truthfully per input type. If extraction returns no
vendor, the header must not render a blank vendor — show a graceful fallback, never an empty string.

**8. Claim detail** (`/app/claims/[id]`): the "Paid by (reimbursed)" label mashes two concepts —
rename to one clear label. A floating "How it works" button sits over every app page including this
one — remove it from app pages or relocate it out of the content area. The settlement breakdown is
bare name chips — give it a proper settlement card with per-person amounts in context.

**9. Activity log** (`/app/activity`): the Details column wraps mid-word ("prompt_vers ion") — fix
word-breaking (break on word boundaries, monospace, never mid-word). Raw machine event names leak
next to human labels ("AI parse completed (ai_parse_ok)") — users get the human label only; keep
machine identifiers out of the UI.

**10. Batch detail footer** (`/app/batches/[id]`): Export CSV + Approve & Pay sit in a grey strip
that feels disconnected from the payouts table — integrate the actions with the table (a proper
table footer / action row). The Approve dialog's confirm button says "Approve & Pay $287.55" while
the page button says "Approve & Pay" — make the labels consistent.

**11. Docs** (`/docs`): anchor links hide section headings under the sticky header — add scroll
offset (`scroll-margin-top`). The API overview area has a sparse, unfinished-feeling gap — fill or
tighten the layout.

**12. Claims inbox details:** disabled row checkboxes have no explanation — add a tooltip or hint
for why a row can't be selected. The search input triggers a password-manager affordance — fix the
input type/autocomplete attributes. The black "n selected" action bar works but is visually heavy
— refine it.

### What's already good — keep and extend

The overall visual language (type system, soft borders, pill badges, confidence bars), the batch
detail page and its timeline, the Approve & Pay dialog's destructive framing (typed confirmation,
disabled-until-typed), docs readability, settings/integrations pages, and the frictionless "Open the
demo" entry. Don't redesign what works — elevate around it.

---

## 4. Design system

- **Aesthetic:** the settlement desk — calm, precise, money-serious fintech. Linear's restraint ×
  Mercury's warmth × Stripe's confidence in numerals. Calm stone surfaces, hairline borders, one
  cobalt accent (`--accent`); money-green reserved for paid/approved states. No decorative
  gradients, no second accent color.
- **Tokens** (`src/app/globals.css`): keep all token names and the `@theme inline` mappings —
  components reference them as Tailwind colors (`bg-panel`, `text-muted`, `border-line`, …). You may
  refine values (deeper shadows, crisper hairlines). Radius: 8px controls, 12px panels, full pills.
- **Type:** Geist Sans; Geist Mono + `tnum` for numerals/IDs/code. Headings semibold, tracking
  `-0.02em` to `-0.035em`. **Numerals are sacred** — after the P0-1 fix, grep every money render
  path and verify.
- **Primitives** (`src/components/ui.tsx`): restyle freely but keep every component name and prop
  contract: `Button` (+ `ButtonLink`; variants `primary | secondary | approve | danger | ghost`;
  sizes `sm | lg`), `Card`, `Pill`, `StatusPill`, `Confidence`, `Money`, `Logo`, `PageHeader`,
  `Empty`, `Field` + `inputCls`, `Alert`. The `approve` variant stays reserved for the payout action.
- **Motion:** motion/react, 200–350ms, `cubic-bezier(0.16, 1, 0.3, 1)`; use for extraction reveals,
  dialog entry, tab transitions, first-paint stagger. Everything disabled under
  `prefers-reduced-motion`.

---

## 5. Guardrails (non-negotiable)

1. **UI layer only:** `src/app/**/page.tsx|layout.tsx`, `src/components/**`, `globals.css`,
   `auth-form.tsx` presentation-only. **NEVER touch** `src/app/api/**`, `src/lib/**`,
   `src/lib/db/**`, `drizzle/**`, `scripts/`, `tests/`, `(auth)/actions.ts`, `demo/route.ts`.
2. No route renames, moves, or additions. No changes to data fetching, props, or API calls.
   Keep the plain `<a href="/demo">` (never `next/link` — the demo route must not be prefetched).
3. **Behavior parity:** every button, filter, tab, dialog, and form works exactly as today.
4. Dark mode (`prefers-color-scheme`), responsive (360/768/1440px), accessibility (aria attributes,
   focus rings, keyboard tabs, reduced motion), and the PayPal simulator/sandbox honesty copy all
   stay intact. Restyle the honesty banners, never remove them.
5. Green gates at the end: `pnpm lint`, `pnpm build`, `pnpm test`.

---

## 6. Execution protocol

Work in this order. Finish each phase fully, run `pnpm lint`, fix everything it reports, then
continue. After each phase, run `pnpm dev` and click through the affected pages before moving on.

1. **Foundation** — `globals.css` + `ui.tsx` primitives, **starting with the money typography fix
   (P0-1).** Render "$287.55" tight at every size before touching anything else.
2. **Claims inbox** — table fit (P0-2), toolbar, selection bar, search input attributes,
   checkbox hints.
3. **Auth** — rebuild the brand-panel visual (P0-3).
4. **New claim** — human-friendly error states with recovery (P1-4), unmistakable extraction
   trigger, truthful step labels, blank-vendor fallback.
5. **Dashboard** — metric tiles, needs-review rows, sidebar badges, microcopy (P1-6).
6. **Claim detail** — labels, settlement card, floating-button removal (P2-8).
7. **Batches + Approve** — action integration, label consistency; keep the ceremony (P2-10).
8. **Activity, members, settings, integrations** — word-break, human labels, polish (P2-9).
9. **Marketing** — landing fixes (P1-5), docs anchors (P2-11), security/pricing touch-ups.
10. **Polish pass** — empty states, skeletons, 360px + dark-mode + reduced-motion + keyboard checks
    on all 17 routes. Then the full gates: `pnpm lint && pnpm build && pnpm test`.

End with `git diff --stat` confirming the diff touches only UI-layer files.

**Operating rules:** work autonomously, no clarifying questions — every decision is in this file.
If a detail isn't specified, choose the option closest to Section 4 and keep moving. If a visual
improvement seems to require a logic change, skip it and note it in your final summary.

---

## 7. Definition of done

- [ ] Every money amount renders tight ("$287.55") — dashboard, inbox, claim header, batches,
      dialog, activity. No gap around the decimal point at any size.
- [ ] Claims table fits its card at 1440px — no horizontal scrollbar, STATUS fully visible.
- [ ] Auth brand panel shows a composed visual — nothing clipped mid-element.
- [ ] Every failure state (extraction, upload, API errors) shows human-friendly copy + a recovery
      action. No raw developer errors reach the UI.
- [ ] FAQ rows fully clickable; pricing cards balanced; docs anchors offset below the sticky nav.
- [ ] The full judge demo flow (Section 2) works in `pnpm dev` with zero console errors.
- [ ] 360px / 768px / 1440px clean; dark mode intentional; reduced-motion safe; keyboard navigable.
- [ ] `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` ✅
- [ ] `git diff --stat` confirms UI-layer files only — no changes to `src/lib/**`,
      `src/app/api/**`, `drizzle/**`, `scripts/**`, `tests/**`, `(auth)/actions.ts`, and no
      renamed/moved/added routes.

---

## 8. File index (UI layer)

```
src/app/globals.css
src/app/layout.tsx
src/app/(marketing)/layout.tsx | page.tsx | security/page.tsx | pricing/page.tsx | docs/page.tsx
src/app/(auth)/layout.tsx | auth-form.tsx | login/page.tsx | signup/page.tsx | onboarding/page.tsx
src/app/app/layout.tsx                  # app shell: sidebar, badges, status, banner
src/app/app/page.tsx                    # dashboard
src/app/app/claims/page.tsx             # inbox (server)
src/app/app/claims/new/page.tsx          # intake (server)
src/app/app/claims/[id]/page.tsx         # claim detail (server)
src/app/app/batches/page.tsx
src/app/app/batches/[id]/page.tsx         # batch detail + approve (server)
src/app/app/activity/page.tsx
src/app/app/members/page.tsx
src/app/app/settings/page.tsx
src/app/app/settings/integrations/page.tsx
src/components/ui.tsx                   # THE primitive library — start here (P0-1 lives here)
src/components/app/sidebar.tsx
src/components/claims/claims-grid.tsx     # AG Grid inbox (P0-2 lives here)
src/components/claims/new-claim.tsx       # extraction theatre (P1-4 lives here)
src/components/claims/claim-editor.tsx
src/components/batches/batch-actions.tsx  # approve dialog
src/components/settings/settings-form.tsx
src/components/settings/members-client.tsx
src/components/marketing/Nav.tsx          # DemoLink: keep plain <a>, never next/link
src/components/marketing/Footer.tsx
src/components/marketing/HowItWorks.tsx
src/components/marketing/Shot.tsx
src/components/marketing/Reveal.tsx
```

Make the judges *feel* the money move — starting with the money itself rendering correctly.
