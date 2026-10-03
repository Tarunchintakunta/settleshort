ALTER TABLE "claims" ADD COLUMN "purpose" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "claims" SET "purpose" = "note" WHERE "purpose" = '' AND "note" <> '' AND "status" IN ('matched','in_batch','partially_paid','paid','failed');
