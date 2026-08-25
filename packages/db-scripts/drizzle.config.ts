import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: '../shared/src/db-schema.ts',
  out: './drizzle',
  dbCredentials: {
    // Подключаемся к базе в Podman (myuser:mypassword@localhost:5432/mydb)
    url:
      process.env.DATABASE_URL ||
      'postgres://myuser:mypassword@localhost:5432/mydb',
  },
});
