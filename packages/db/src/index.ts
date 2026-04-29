import { PrismaClient } from '@prisma/client';

// ─── Singleton de Prisma Client ───────────────────────────────────────────────
// Evita crear múltiples conexiones en hot-reload de desarrollo

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export default prisma;
