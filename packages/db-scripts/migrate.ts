import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('⏳ Начинаем применение миграций к БД в Podman...');

  const dbUrl =
    process.env.DATABASE_URL ||
    'postgres://myuser:mypassword@localhost:5432/mydb';
  const migrationClient = postgres(dbUrl, { max: 1 });
  const db = drizzle(migrationClient);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, './drizzle'),
  });

  console.log('✅ Все миграции успешно применены!');
  await migrationClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Ошибка во время выполнения миграций:', err);
  process.exit(1);
});
