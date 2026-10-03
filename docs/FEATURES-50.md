# SettleShort — 50-feature gap analysis and build plan

Branch: `feat/claims-engine-50`. Each feature lands as its own commit, in list order.

## Where the code stands today

| Area | Current behavior | Code |
| --- | --- | --- |
| Claim model | One claim = one source (a receipt **or** a message). One `payerUserId`, even `claim_splits`. | `src/lib/db/schema.ts`, `src/lib/claims.ts` |
| AI | One overall `aiConfidence`. Evidence quotes for vendor/total/date only. | `src/lib/ai.ts`, `ai-local.ts`, `ai-claude.ts` |
| Duplicates | Rule score (amount/date/merchant/payer) across all claims in the workspace, AI rationale. | `src/lib/matching.ts`, `runMatching` |
| Approval | Admin "Mark ready" sets `matched`. No approval record, no snapshot, self-approval allowed. | `api/v1/claims/[id]/route.ts` |
| Payout | Admin batch approve with typed `APPROVE`, workspace caps, atomic status flip, `PayPal-Request-Id`. Full `amountCents` paid to payer. | `src/lib/batches.ts`, `src/lib/paypal.ts` |
| Money owed | No ledger. A claim is either unpaid or `paid`. | — |
| Audit | `audit_events` table, human labels in `activity.ts`. | `src/lib/audit.ts` |

## Shared foundations (built once, reused)

- `src/lib/settlement.ts` — pure money math: payments, funding sources, line inclusion, tax/tip allocation, FX, ledger balance. Unit-tested.
- `src/lib/policy.ts` — pure approval rules: self-approval, limits, delegation, release authority, snapshot hash. Unit-tested.
- `src/lib/evidence.ts` — pure evidence logic: fingerprints, contradictions, missing-field questions. Unit-tested.
- Schema additions are additive (new tables, nullable columns) so existing rows keep working.

## The 50 items

Status key: **Missing** = no code today. **Partial** = some behavior exists.

### Understand messy claims

| # | Feature | Today | Plan |
| --- | --- | --- | --- |
| 1 | Combine scattered evidence | Missing. One source per claim. | `claim_evidence` table. Attach receipt/message/invoice to an existing claim (`POST /claims/:id/evidence`). Claim keeps its own fields; evidence rows keep their own extracts. |
| 2 | Ask only the missing question | Missing. | `missingFields()` in `evidence.ts` returns the one question per missing field (purpose, date, vendor, amount). Shown on claim page with a single-field answer box. |
| 3 | Field-level uncertainty | Partial. One overall score. | `field_confidence` per field in the extract (AI prompt + local parser). Editor highlights uncertain fields. |
| 4 | Payer vs participants vs budget | Partial. Payer + splits only. | `budget_owner_user_id` column. Participants = splits. Shown separately. |
| 5 | Explain claim matching | Missing. | `scoreEvidenceToClaim()` returns score + reasons; ambiguous matches (two close candidates) require confirmation. |
| 6 | Contradictory evidence | Missing. | `findContradictions()` compares amount/date/vendor across evidence rows. Flag + block "ready" until resolved. |
| 7 | Understand corrections | Missing. | `parseCorrection()` handles "actually X paid", "it was 2500". Applies change, keeps original in `corrections` history. |
| 8 | Suggest business purpose from approved context | Missing. | `contexts` table (customer meeting / project, admin-entered). Suggest only from those; never generated text. |
| 9 | Missing receipts honestly | Missing. | `declaration` evidence kind with signed reason. Claim flagged `missing_receipt` exception for approvers. |
| 10 | Reuse merchant mappings | Missing. | `merchant_mappings` table + `category` column. Auto-apply on create, visible and editable. |

### Work out what is actually owed

| # | Feature | Today | Plan |
| --- | --- | --- | --- |
| 11 | Obligation breakdown | Partial. | `obligationBreakdown()` returns paid-by / benefits / approver / owed. Settlement card renders it. |
| 12 | Multiple payers | Missing. | `claim_payments` table (who paid how much). Reimbursement split per payer. |
| 13 | Reimburse only employee-funded part | Missing. | `claim_payments.source` = employee / company_card / advance. Only employee rows are owed. |
| 14 | Partial repayments | Missing. | `ledger_entries` table. Balance = owed − repaid. Status `partially_paid`. |
| 15 | Refunds adjust the original claim | Missing. | Refund ledger entry; claim reopens with negative balance (employee owes back) or reduced owed amount. |
| 16 | Cross-person duplicates | Partial. Matcher compares all payers. | Raise score for same vendor+date+amount across different submitters; label "claimed by someone else". |
| 17 | Duplicate evidence across channels | Missing. | Content fingerprint (file SHA-256 + normalized vendor/amount/date key) on evidence; reject or link. |
| 18 | Line-level personal items | Missing. | `claim_lines` table with `excluded` + reason. Claim amount = included lines. |
| 19 | Tax and tip allocation | Missing. | `allocateExtras()` distributes tax/tip proportionally over included lines, then per participant. |
| 20 | Currency transparency | Missing. | `receipt_amount/currency`, `charged_amount/currency`, `fx_rate`, `fx_source` columns. Shown side by side. |

### Make approval genuinely safe

| # | Feature | Today | Plan |
| --- | --- | --- | --- |
| 21 | Approver decision brief | Missing. | `decisionBrief()` on claim page: amount, purpose, gaps, unusual flags. |
| 22 | Approve individual lines | Missing. | Line `approval_status` approved/held. Batch pays approved lines only. |
| 23 | Invalidate approval after material change | Partial. Edits after "ready" keep `matched`. | `approvals` table with snapshot hash of amount/recipient/evidence. Material edit → invalidate → `pending_review`. |
| 24 | Prevent self-approval | Missing. | Policy blocks approving own claim / batch containing own claim; workspace `alternate_approver_id`. |
| 25 | Check authority at approval time | Partial. Role re-read per request. | Explicit `canApprove()` check inside the approval write, after limits and delegation. |
| 26 | Enforce approval limits | Partial. Hard workspace caps. | `memberships.approval_limit_cents`. Over limit → needs a second approver with enough authority. |
| 27 | Temporary delegation | Missing. | `delegations` table with `ends_at`; approval records `on_behalf_of`. |
| 28 | Separate approval from release | Missing. | `memberships.can_release`. Batch payout requires release authority; claim approval does not. |
| 29 | Targeted fix requests | Missing. | `fix_requests` on a claim (field + message). Claim → `needs_info`; resolved when field updated. |
| 30 | Final change check before release | Missing. | Release compares each claim snapshot hash with its approval hash; lists diffs and blocks until re-approved. |

### Close the loop without chasing

| # | Feature | Today | Plan |
| --- | --- | --- | --- |
| 31 | One truthful status | Partial. | `truthfulStatus()` derives submitted / approved / scheduled / processing / failed / paid / confirmed_received. |
| 32 | Duplicate-safe retries | Partial. Batch flip is atomic. | Idempotency key on payout creation, webhook dedupe by event id, retry re-uses same `sender_batch_id`. |
| 33 | Uncertain outcomes | Missing. Timeout marks batch failed and releases claims (double-pay risk). | Timeout/5xx → `unknown` status; verify with `GET payout` before any resend. |
| 34 | Mismatched records workflow | Missing. | `investigations` table; employee "I didn't receive it" opens one against a paid item. |
| 35 | Disputed vs undisputed | Missing. | Disputed lines held, undisputed paid; dispute stays visible. |
| 36 | Explain every reminder | Missing. | `blockerFor()` returns what blocks the claim + smallest action. Used by reminders and UI. |
| 37 | Escalation by policy | Missing. | Workspace `escalation_days` + chain; overdue claims route to next person, logged. |
| 38 | Employee balance view | Missing. | `/app/me` page: owed, partial, disputed per claim from ledger. |
| 39 | Founder exception inbox | Missing. | `/app/exceptions`: stuck, conflicting, over-limit, uncertain payouts only. |
| 40 | Closure record | Missing. | `/app/claims/:id/record` printable history: evidence, amounts, approvals, adjustments, payout refs. |

### Fit how small SaaS teams operate

| # | Feature | Today | Plan |
| --- | --- | --- | --- |
| 41 | Refundable deposits | Missing. | `kind = deposit`, `deposit_status` held / returned / consumed. |
| 42 | Customer-recoverable expenses | Missing. | `recoverable_client`, `recovery_status` none / to_invoice / invoiced / recovered. |
| 43 | Personally funded SaaS | Missing. | Recurring vendor + employee-funded + SaaS category ≥ 2 months → warning. |
| 44 | Overlapping software purchases | Missing. | Same normalized SaaS vendor claimed by two people in the same period → flag. |
| 45 | Post-offboarding obligations | Missing. | `memberships.offboarded_at`; offboarding report of unpaid balances and subscriptions. |
| 46 | Project advances | Missing. | `advances` table; claims draw down an advance; report advanced vs spent vs left. |
| 47 | Accountant evidence pack | Partial. Batch CSV only. | Export: claims CSV with categories, approvals, adjustments, exceptions + receipt links. |
| 48 | Privacy-preserving evidence | Missing. | `redactions` on evidence text (statement lines hidden, kept line visible). |
| 49 | Challenge AI decisions | Missing. | `ai_feedback` table; correction with reason; suppress that suggestion for that subject. Policy untouched. |
| 50 | Real metrics | Missing. | `/app/insights`: median approval time, employee money outstanding, unresolved claims, confirmed duplicates stopped. From real rows only. |
