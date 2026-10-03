ALTER TABLE "claims" ADD COLUMN "escalated_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "escalates_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "escalation_days" integer DEFAULT 2 NOT NULL;