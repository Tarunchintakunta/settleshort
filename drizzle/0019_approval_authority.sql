CREATE TABLE "delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "covers_cents" integer;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "approval_limit_cents" integer;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "second_approval_above_cents" integer;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delegations_ws_to" ON "delegations" USING btree ("workspace_id","to_user_id");