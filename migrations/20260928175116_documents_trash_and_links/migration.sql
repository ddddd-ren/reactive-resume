ALTER TABLE "cover_letter" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "trashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "application_id" text;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "trashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "auto_name" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_application_id_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE SET NULL;