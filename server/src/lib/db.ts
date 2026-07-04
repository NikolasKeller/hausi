import './env.js';
import { PrismaClient } from '@prisma/client';

// The Prisma CLI reads server/.env itself; the Node runtime doesn't, so fall
// back to the local dev database when DATABASE_URL isn't set. The path is
// relative to the server/ working directory.
export const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';

export const db = new PrismaClient({ datasourceUrl: DATABASE_URL });
