import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    '❌ Критическая ошибка: Не удалось загрузить DATABASE_URL из корневого .env файла!'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: '../shared/src/db-schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: dbUrl,
  },
});
