CREATE TABLE "claim_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"file_key" text,
	"file_mime" text,
	"file_name" text,
	"raw_text" text,
	"extract_json" jsonb,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_evidence_claim" ON "claim_evidence" USING btree ("claim_id");--> statement-breakpoint
INSERT INTO "claim_evidence" ("workspace_id", "claim_id", "kind", "source", "file_key", "file_mime", "file_name", "raw_text", "extract_json", "added_by", "created_at")
SELECT "workspace_id", "id", CASE WHEN "receipt_key" IS NOT NULL THEN 'receipt' ELSE 'message' END, "source", "receipt_key", "receipt_mime", "receipt_name", "raw_text", "ai_json", "submitter_id", "created_at"
FROM "claims" WHERE "receipt_key" IS NOT NULL OR "raw_text" IS NOT NULL;
