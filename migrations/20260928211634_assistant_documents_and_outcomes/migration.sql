DROP INDEX "agent_threads_active_in_place_unique";--> statement-breakpoint
ALTER TABLE "agent_threads" ADD COLUMN "cover_letter_id" text;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD COLUMN "edits_proposed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD COLUMN "edits_accepted" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_threads_cover_letter_id_index" ON "agent_threads" ("cover_letter_id");--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_cover_letter_id_cover_letter_id_fkey" FOREIGN KEY ("cover_letter_id") REFERENCES "cover_letter"("id") ON DELETE SET NULL;