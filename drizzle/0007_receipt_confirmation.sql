ALTER TABLE "batch_items" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "batch_items" ADD COLUMN "not_received_at" timestamp with time zone;