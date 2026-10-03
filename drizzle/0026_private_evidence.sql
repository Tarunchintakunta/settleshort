ALTER TABLE "claim_evidence" ADD COLUMN "private_file" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD COLUMN "redacted_count" integer DEFAULT 0 NOT NULL;