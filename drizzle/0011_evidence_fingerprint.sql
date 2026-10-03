ALTER TABLE "claim_evidence" ADD COLUMN "file_hash" text;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD COLUMN "content_key" text;--> statement-breakpoint
CREATE INDEX "claim_evidence_ws_hash" ON "claim_evidence" USING btree ("workspace_id","file_hash");--> statement-breakpoint
CREATE INDEX "claim_evidence_ws_key" ON "claim_evidence" USING btree ("workspace_id","content_key");