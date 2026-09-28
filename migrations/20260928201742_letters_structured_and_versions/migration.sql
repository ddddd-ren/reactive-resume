CREATE TABLE "cover_letter_version" (
	"id" text PRIMARY KEY,
	"cover_letter_id" text NOT NULL,
	"user_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"kind" text DEFAULT 'auto' NOT NULL,
	"name" text,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "sent_cover_letter_version_id" text;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "layout" text DEFAULT 'freeform' NOT NULL;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "recipient_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "recipient_company" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "letter_date" text;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "sender_linked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cover_letter" ADD COLUMN "design_linked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "cover_letter_version_cover_letter_id_created_at_index" ON "cover_letter_version" ("cover_letter_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "cover_letter_version_session_unique" ON "cover_letter_version" ("cover_letter_id","session_id") WHERE "kind" = 'auto';--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_QJaGmijrxJ0T_fkey" FOREIGN KEY ("sent_cover_letter_version_id") REFERENCES "cover_letter_version"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cover_letter_version" ADD CONSTRAINT "cover_letter_version_cover_letter_id_cover_letter_id_fkey" FOREIGN KEY ("cover_letter_id") REFERENCES "cover_letter"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cover_letter_version" ADD CONSTRAINT "cover_letter_version_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;