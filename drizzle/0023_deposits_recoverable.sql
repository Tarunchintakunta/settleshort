ALTER TABLE "claims" ADD COLUMN "kind" text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "deposit_status" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "deposit_note" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "recoverable_client" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "recovery_status" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "recovery_ref" text;