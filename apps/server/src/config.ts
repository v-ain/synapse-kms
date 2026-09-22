if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in .env file');
}

if (!process.env.SERVER_PORT) {
  throw new Error('SERVER_PORT is not defined in .env file');
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  serverPort: Number(process.env.SERVER_PORT) || 3000,
  isProduction: process.env.NODE_ENV === 'production',
} as const;
