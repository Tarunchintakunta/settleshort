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
    addedBy: uuid("added_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("claim_evidence_claim").on(t.claimId)],
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
