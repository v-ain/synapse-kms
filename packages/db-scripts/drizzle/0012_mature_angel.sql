-- 🔒 ОБОРАЧИВАЕМ ВСЁ В ACID-ТРАНЗАКЦИЮ ДЛЯ ПОЛНОЙ БЕЗОПАСНОСТИ
BEGIN;

-- Шаг 1. Создаем новые изолированные таблицы (как сгенерировал Drizzle)
CREATE TABLE "user_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "user_credentials_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_credentials_email_unique" UNIQUE("email")
);

CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username")
);

CREATE TABLE "user_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"max_notes" integer DEFAULT 100 NOT NULL,
	"used_notes" integer DEFAULT 0 NOT NULL,
	"max_storage_mb" integer DEFAULT 50 NOT NULL,
	CONSTRAINT "user_quotas_user_id_unique" UNIQUE("user_id")
);

-- Шаг 2. Добавляем системные поля и констреинты связей
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;

ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_quotas" ADD CONSTRAINT "user_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- ========================================================
-- 🧙‍♂️ ШАГ 3. МАГИЯ МИГРАЦИИ ДАННЫХ (СПАСАЕМ ТВОИХ ЮЗЕРОВ!)
-- ========================================================

-- Переносим учетные данные (Credentials)
INSERT INTO "user_credentials" ("user_id", "email", "password_hash")
SELECT "id", "email", "password_hash" FROM "users"
ON CONFLICT DO NOTHING;

-- Переносим публичные профили (Profiles)
INSERT INTO "user_profiles" ("user_id", "username", "display_name")
SELECT "id", "username", "display_name" FROM "users"
WHERE "username" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Переносим лимиты и квоты (Quotas), подтягивая старые счетчики заметок
INSERT INTO "user_quotas" ("user_id", "tier", "max_notes", "used_notes", "max_storage_mb")
SELECT "id", "tier", "max_notes", "used_notes", 50 FROM "users"
ON CONFLICT DO NOTHING;

-- ========================================================
-- ШАГ 4. ЗАЧИСТКА СТАРОЙ ТАБЛИЦЫ (Только после переноса данных!)
-- ========================================================
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_unique";

ALTER TABLE "users" DROP COLUMN "email";
ALTER TABLE "users" DROP COLUMN "password_hash";
ALTER TABLE "users" DROP COLUMN "username";
ALTER TABLE "users" DROP COLUMN "display_name";
ALTER TABLE "users" DROP COLUMN "tier";
ALTER TABLE "users" DROP COLUMN "max_notes";
ALTER TABLE "users" DROP COLUMN "used_notes";

COMMIT;
-- 🔓 ТРАНЗАКЦИЯ УСПЕШНО ЗАВЕРШЕНА. ДАННЫЕ РАЗЛОЖЕНЫ ПО ЧЕТЫРЕМ ТАБЛИЦАМ!
