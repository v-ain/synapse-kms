CREATE TYPE "public"."access_level" AS ENUM('read', 'write');--> statement-breakpoint
CREATE TABLE "folder_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"access_level" "access_level" DEFAULT 'read' NOT NULL,
	CONSTRAINT "folder_user_unique_idx" UNIQUE("folder_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "folder_shares" ADD CONSTRAINT "folder_shares_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_shares" ADD CONSTRAINT "folder_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_user_id_idx" ON "folder_shares" USING btree ("user_id");