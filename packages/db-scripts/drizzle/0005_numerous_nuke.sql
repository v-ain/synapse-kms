-- 1. Добавляем колонку как nullable (разрешаем NULL), чтобы база не ругалась на отсутствие данных в старых строках
ALTER TABLE "notes" ADD COLUMN "client_updated_at" timestamp with time zone;
--> statement-breakpoint

-- 2. Мигрируем данные: копируем старые даты изменений в новую колонку
UPDATE "notes" SET "client_updated_at" = "updated_at" WHERE "client_updated_at" IS NULL;
--> statement-breakpoint

-- 3. Теперь, когда все строки заполнены, накатываем ограничение NOT NULL и дефолтное значение для будущих записей
ALTER TABLE "notes" ALTER COLUMN "client_updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "client_updated_at" SET NOT NULL;
--> statement-breakpoint

-- 4. Удаляем старую колонку контроля версий
ALTER TABLE "notes" DROP COLUMN "version";

