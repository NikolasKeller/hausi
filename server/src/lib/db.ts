import { PrismaClient } from '@prisma/client';

// Relative sqlite paths resolve against the schema.prisma directory, so the
// dev default is server/prisma/dev.db. Production sets DATABASE_URL to an
// absolute file: path on a persistent volume.
export const db = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
});
