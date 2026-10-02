import { sql } from "drizzle-orm";
import {
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
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_ws_user").on(t.workspaceId, t.userId)],
);

export const CLAIM_STATUSES = ["draft", "pending_review", "matched", "in_batch", "paid", "failed", "rejected"] as const;
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

export const claimSplits = pgTable("claim_splits", {
  id: id(),
  claimId: uuid("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  shareBps: integer("share_bps").notNull(),
});

export const BATCH_STATUSES = ["draft", "awaiting_approval", "submitting", "submitted", "completed", "partial", "failed"] as const;
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
