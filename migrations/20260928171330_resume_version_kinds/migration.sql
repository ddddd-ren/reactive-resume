CREATE TABLE "resume_slug_redirect" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL,
	"resume_id" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_slug_redirect_user_id_slug_unique" UNIQUE("user_id","slug")
);
--> statement-breakpoint
DROP INDEX "resume_user_id_index";--> statement-breakpoint
ALTER TABLE "resume_version" ADD COLUMN "kind" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
UPDATE "resume_version" SET "kind" = CASE "label" WHEN 'Imported' THEN 'import' WHEN 'AI edit' THEN 'ai' WHEN 'Before restore' THEN 'before-restore' WHEN 'Restored version' THEN 'restored' ELSE 'auto' END;--> statement-breakpoint
ALTER TABLE "resume_version" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "resume_version" ADD COLUMN "session_id" text;--> statement-breakpoint
CREATE INDEX "resume_slug_redirect_resume_id_index" ON "resume_slug_redirect" ("resume_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resume_version_session_unique" ON "resume_version" ("resume_id","session_id") WHERE "kind" = 'auto';--> statement-breakpoint
ALTER TABLE "resume_slug_redirect" ADD CONSTRAINT "resume_slug_redirect_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_slug_redirect" ADD CONSTRAINT "resume_slug_redirect_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;