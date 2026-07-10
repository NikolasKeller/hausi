// One-off cleanup: replace em dashes in already-seeded event titles with the
// colon form now used by the seed scripts (app copy must not contain em
// dashes). Idempotent: events without an em dash are left untouched.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const events = await db.event.findMany({
    where: { title: { contains: '—' } },
    select: { id: true, title: true },
  });
  for (const event of events) {
    const title = event.title.replace(/\s*—\s*/g, ': ');
    await db.event.update({ where: { id: event.id }, data: { title } });
    console.log(`renamed: ${event.title} -> ${title}`);
  }
  console.log(`done, ${events.length} title(s) updated`);
}

main().finally(() => db.$disconnect());
