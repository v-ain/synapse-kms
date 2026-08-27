import { initTRPC } from '@trpc/server';
import { type Context } from './context.js';

// Инициализируем tRPC с привязкой к нашему будущему контексту
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
