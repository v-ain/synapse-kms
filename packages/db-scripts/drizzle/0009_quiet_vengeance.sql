ALTER TABLE "tags" DROP CONSTRAINT "tags_name_unique";--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- ШАГ: Связываем старые теги с владельцами заметок через таблицу моста!
-- Если тег привязан к заметке Юзера_Х, мы проставляем этому тегу user_id = Юзер_Х.
-- Если тег «бесхозный», подставляем ID любого существующего юзера из базы.
UPDATE "tags" t
SET "user_id" = COALESCE(
  (SELECT n.user_id FROM "notes_tags" nt 
   JOIN "notes" n ON n.id = nt.note_id 
   WHERE nt.tag_id = t.id LIMIT 1),
  (SELECT id FROM "users" LIMIT 1)
);--> statement-breakpoint

ALTER TABLE "tags" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_tag_name" ON "tags" USING btree ("user_id","name");
