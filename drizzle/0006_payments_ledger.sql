CREATE TABLE "claim_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"user_id" uuid,
	"source" text NOT NULL,
	"amount_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"reference" text,
	"batch_item_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batch_items" ADD COLUMN "receiver_user_id" uuid;--> statement-breakpoint
ALTER TABLE "batch_items" ADD COLUMN "payout_group" text;--> statement-breakpoint
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_claim" ON "ledger_entries" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "ledger_ws_user" ON "ledger_entries" USING btree ("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_receiver_user_id_users_id_fk" FOREIGN KEY ("receiver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "batch_items" bi SET "receiver_user_id" = c."payer_user_id", "payout_group" = bi."claim_id"::text FROM "claims" c WHERE c."id" = bi."claim_id";
--> statement-breakpoint
INSERT INTO "ledger_entries" ("workspace_id", "claim_id", "user_id", "kind", "amount_cents", "currency", "reference", "batch_item_id")
SELECT c."workspace_id", bi."claim_id", bi."receiver_user_id", 'payout', bi."amount_cents", bi."currency", bi."transaction_id", bi."id"
FROM "batch_items" bi JOIN "claims" c ON c."id" = bi."claim_id" WHERE bi."status" = 'SUCCESS';
