import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"), // null = invited, not signed up yet
  createdAt: createdAt(),
});

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  maxSingleCents: integer("max_single_cents").notNull(),
  maxBatchCents: integer("max_batch_cents").notNull(),
  isDemo: integer("is_demo").notNull().default(0),
  // Policy: claims at or above this need a receipt/invoice, or an honest missing-receipt declaration.
  receiptRequiredCents: integer("receipt_required_cents").notNull().default(2500),
  // Approves claims submitted by, or paid to, admins (maker-checker for founders).
  alternateApproverId: uuid("alternate_approver_id"),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    paypalReceiverEmail: text("paypal_receiver_email"),
    // Release authority: may send approved money to PayPal. Separate from approving claims.
    canRelease: boolean("can_release").notNull().default(false),
    // Set when an admin confirms the PayPal address belongs to this person, or after a successful payout.
    // Changing the address clears it; unverified receivers can't be paid.
    paypalVerifiedAt: timestamp("paypal_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_ws_user").on(t.workspaceId, t.userId)],
);

export const CLAIM_STATUSES = ["draft", "pending_review", "matched", "in_batch", "partially_paid", "paid", "failed", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const claims = pgTable(
  "claims",
  {
    id: id(),
    number: integer("number").notNull(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    submitterId: uuid("submitter_id").notNull().references(() => users.id),
    source: text("source", { enum: ["upload", "slack", "email", "manual"] }).notNull(),
    vendor: text("vendor").notNull().default(""),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    txnDate: text("txn_date"), // YYYY-MM-DD
    tipCents: integer("tip_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    note: text("note").notNull().default(""),
    // Business purpose: why the company should pay. Required before approval; never invented by AI.
    purpose: text("purpose").notNull().default(""),
    category: text("category"),
    // Whose budget covers it (a team lead or cost owner), separate from who paid and who attended.
    budgetOwnerUserId: uuid("budget_owner_user_id").references(() => users.id),
    // Adjust-and-approve: the approver approved this much less, for the stated reason (shown to the claimant).
    adjustmentCents: integer("adjustment_cents").notNull().default(0),
    adjustmentReason: text("adjustment_reason"),
    // "mapping" = filled from a confirmed merchant rule; "human" = set by a person on this claim.
    categorySource: text("category_source"),
    rawText: text("raw_text"),
    // S3 object key only (receipts/{workspaceId}/{claimId}/{uuid}.{ext}); viewed via short-lived presigned GET URLs.
    receiptKey: text("receipt_key"),
    receiptMime: text("receipt_mime"),
    receiptName: text("receipt_name"),
    aiJson: jsonb("ai_json"),
    aiConfidence: real("ai_confidence"),
    payerUserId: uuid("payer_user_id").notNull().references(() => users.id),
    status: text("status", { enum: CLAIM_STATUSES }).notNull().default("pending_review"),
    duplicateOfId: uuid("duplicate_of_id"),
    matchJson: jsonb("match_json"),
    // Contradictions between evidence that a human accepted, as { key, by, note, at } (see lib/evidence.ts).
    acknowledgedConflicts: jsonb("acknowledged_conflicts").$type<{ key: string; by: string; note: string; at: string }[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("claims_ws_status").on(t.workspaceId, t.status),
    uniqueIndex("claims_ws_number").on(t.workspaceId, t.number),
  ],
);

export const EVIDENCE_KINDS = ["receipt", "invoice", "message", "declaration", "statement"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Every piece of proof behind a claim: receipts, invoices, chat messages, declarations. */
export const claimEvidence = pgTable(
  "claim_evidence",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: EVIDENCE_KINDS }).notNull(),
    source: text("source", { enum: ["upload", "slack", "email", "manual"] }).notNull(),
    fileKey: text("file_key"),
    fileMime: text("file_mime"),
    fileName: text("file_name"),
    rawText: text("raw_text"),
    extractJson: jsonb("extract_json"),
    // SHA-256 of the original file, and a vendor|amount|currency|date key (see contentKey) for cross-channel duplicates.
    fileHash: text("file_hash"),
    contentKey: text("content_key"),
    addedBy: uuid("added_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("claim_evidence_claim").on(t.claimId), index("claim_evidence_ws_hash").on(t.workspaceId, t.fileHash), index("claim_evidence_ws_key").on(t.workspaceId, t.contentKey)],
);

export const claimSplits = pgTable("claim_splits", {
  id: id(),
  claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  shareBps: integer("share_bps").notNull(),
});

// unknown = PayPal may or may not have accepted the payout; claims stay locked until verified.
export const BATCH_STATUSES = ["draft", "awaiting_approval", "submitting", "unknown", "submitted", "completed", "partial", "failed"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const batches = pgTable(
  "batches",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    status: text("status", { enum: BATCH_STATUSES }).notNull().default("awaiting_approval"),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull(),
    paypalPayoutBatchId: text("paypal_payout_batch_id"),
    paypalMode: text("paypal_mode"), // sandbox | simulated
    paypalResponse: jsonb("paypal_response"),
    errorMessage: text("error_message"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("batches_ws").on(t.workspaceId)],
);

export const batchItems = pgTable("batch_items", {
  id: id(),
  batchId: uuid("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  claimId: uuid("claim_id").notNull().references(() => claims.id),
  receiverEmail: text("receiver_email").notNull(),
  receiverName: text("receiver_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  paypalItemId: text("paypal_item_id"),
  status: text("status").notNull().default("NEW"), // NEW | PENDING | SUCCESS | UNCLAIMED | FAILED | ...
  receiverUserId: uuid("receiver_user_id").references(() => users.id),
  // PayPal sender_item_id shared by every item netted into one payout to the same receiver.
  payoutGroup: text("payout_group"),
  // The receiver's own word: money arrived, or it didn't (opens an investigation).
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  notReceivedAt: timestamp("not_received_at", { withTimezone: true }),
  transactionId: text("transaction_id"),
  errorMessage: text("error_message"),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id"), // null = system / webhook
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metaJson: jsonb("meta_json"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_ws_created").on(t.workspaceId, sql`${t.createdAt} desc`)],
);

export const aiJobs = pgTable("ai_jobs", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["receipt", "text"] }).notNull(),
  status: text("status", { enum: ["running", "done", "error"] }).notNull(),
  provider: text("provider").notNull(),
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json"),
  error: text("error"),
  claimId: uuid("claim_id"),
  createdAt: createdAt(),
});

/** PayPal webhook event ids already processed; a replayed delivery is acknowledged and skipped. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A human sign-off on a claim, bound to a snapshot of what was approved. */
export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    approverId: uuid("approver_id").notNull().references(() => users.id),
    onBehalfOfId: uuid("on_behalf_of_id").references(() => users.id),
    snapshotHash: text("snapshot_hash").notNull(),
    snapshotJson: jsonb("snapshot_json").notNull(),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    invalidReason: text("invalid_reason"),
    createdAt: createdAt(),
  },
  (t) => [index("approvals_claim").on(t.claimId)],
);

/** Who funded a claim: employees (reimbursed), the company card or an advance (not reimbursed). */
export const claimPayments = pgTable("claim_payments", {
  id: id(),
  claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  source: text("source", { enum: ["employee", "company_card", "advance"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
});

/** Append-only money movements per claim and person: payouts, repayments, refunds, clawbacks. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id),
    kind: text("kind", { enum: ["payout", "payout_reversal", "repayment", "refund", "clawback"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    reference: text("reference"),
    batchItemId: uuid("batch_item_id"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_claim").on(t.claimId), index("ledger_ws_user").on(t.workspaceId, t.userId)],
);

export { CATEGORIES } from "../categories";

/** Confirmed "this merchant is always this category" rules. Only a person creates or changes them. */
export const merchantMappings = pgTable(
  "merchant_mappings",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    merchantKey: text("merchant_key").notNull(),
    merchantLabel: text("merchant_label").notNull(),
    category: text("category").notNull(),
    confirmedBy: uuid("confirmed_by").notNull().references(() => users.id),
    uses: integer("uses").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("merchant_mappings_ws_key").on(t.workspaceId, t.merchantKey)],
);

/**
 * Every time a person overrules the AI or the rules: a duplicate call, a category, an extracted field.
 * Feeds the evaluation set; never changes company policy by itself.
 */
export const aiFeedback = pgTable(
  "ai_feedback",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").references(() => claims.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["duplicate", "category", "extraction", "split"] }).notNull(),
    subject: text("subject").notNull(),
    suggested: text("suggested"),
    corrected: text("corrected"),
    reason: text("reason"),
    actorId: uuid("actor_id").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("ai_feedback_ws").on(t.workspaceId, t.kind)],
);

/** Receipt line items: exclude personal ones, approve or hold each one (tax and tip are spread over them). */
export const claimLines = pgTable(
  "claim_lines",
  {
    id: id(),
    claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    excluded: boolean("excluded").notNull().default(false),
    // Shown to the claimant: why this line isn't reimbursed (personal, over_policy, missing_receipt, duplicate_item, other).
    excludeReason: text("exclude_reason"),
    state: text("state", { enum: ["pending", "approved", "held", "disputed"] }).notNull().default("pending"),
    decisionNote: text("decision_note"),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("claim_lines_claim").on(t.claimId)],
);
