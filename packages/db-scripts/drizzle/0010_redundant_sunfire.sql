-- ОБОРАЧИВАЕМ ВСЁ В ACID-ТРАНЗАКЦИЮ
BEGIN;

-- Шаг 1. Добавляем новые колонки
ALTER TABLE "users" ADD COLUMN "username" text;
ALTER TABLE "users" ADD COLUMN "display_name" text;
ALTER TABLE "users" ADD COLUMN "tier" text DEFAULT 'free' NOT NULL;
ALTER TABLE "users" ADD COLUMN "max_notes" integer DEFAULT 1000 NOT NULL;
ALTER TABLE "users" ADD COLUMN "used_notes" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

-- Шаг 2. ИСПРАВЛЕННЫЙ ПОДСЧЕТ ЗАМЕТОК
-- Считаем ВСЕ физические строки пользователя в таблице notes
UPDATE "users" u
SET
  "username" = '@' || lower(split_part(u."email", '@', 1)),
  "used_notes" = (
    SELECT count(*)::integer
    FROM "notes" n
    WHERE n."user_id" = u."id"
  )
WHERE u."username" IS NULL;

-- Шаг 3. Вешаем ограничение уникальности на никнеймы
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");

-- Шаг 4. Накатываем жесткий NOT NULL на username
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

COMMIT;
-- ТРАНЗАКЦИЯ УСПЕШНО ЗАВЕРШЕНА. ЛИМИТЫ ЗАЩИЩЕНЫ!
