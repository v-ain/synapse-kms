import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@synapse-kms/shared';
import { config } from './config.js';

// Спокойно берем строку подключения, TypeScript знает, что она string
const queryConnection = postgres(config.databaseUrl);

export const db = drizzle(queryConnection, { schema });

export type DrizzleDB = typeof db;
