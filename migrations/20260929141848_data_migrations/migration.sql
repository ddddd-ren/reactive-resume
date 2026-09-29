CREATE TABLE "data_migration" (
	"name" text PRIMARY KEY,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
