import { db } from './db.js';
import { normalizePhone } from './phone.js';

// Before phone numbers were canonicalized, the same person could create several
// accounts by typing their number differently (a German mobile as "+49 0176…"
// vs "+49 176…"). This one-time-safe, idempotent routine collapses each such
// cluster into a single account: it reassigns every event/RSVP/etc. from
// the duplicates onto one primary row, then deletes the duplicates. Runs on
// boot; once the data is clean it makes no writes.
export async function dedupeUsersByPhone(): Promise<{ merged: number; renormalized: number }> {
  const users = await db.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Cluster by canonical phone.
  const clusters = new Map<string, typeof users>();
  for (const u of users) {
    const canonical = normalizePhone(u.phone as string);
    const bucket = clusters.get(canonical);
    if (bucket) bucket.push(u);
    else clusters.set(canonical, [u]);
  }

  let merged = 0;
  let renormalized = 0;

  for (const [canonical, cluster] of clusters) {
    // A completed profile (has a name) wins; otherwise the oldest row wins.
    const ordered = [...cluster].sort((a, b) => {
      const aHasName = a.name.trim() ? 0 : 1;
      const bHasName = b.name.trim() ? 0 : 1;
      if (aHasName !== bHasName) return aHasName - bHasName;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const primary = ordered[0];
    const duplicates = ordered.slice(1);

    try {
      for (const dupe of duplicates) {
        await mergeUser(dupe.id, primary.id);
        merged += 1;
      }
      // Rewrite the survivor's phone to canonical form (also covers the common
      // single-account case where only the stored format was off).
      if (primary.phone !== canonical) {
        await db.user.update({ where: { id: primary.id }, data: { phone: canonical } });
        renormalized += 1;
      }
    } catch (e) {
      // Never let one bad cluster abort the rest or crash the boot.
      console.error(`dedupeUsersByPhone: cluster ${canonical} failed:`, e);
    }
  }

  if (merged || renormalized) {
    console.log(`dedupeUsersByPhone: merged ${merged} duplicate account(s), renormalized ${renormalized} phone(s)`);
  }
  return { merged, renormalized };
}

// Move everything owned by `fromId` onto `toId`, then delete `fromId`. The
// three tables with a compound unique key (RSVP, cohost, crush) need per-row
// conflict handling: if the survivor already has the equivalent row, the
// duplicate's is dropped instead of reassigned (which would violate the index).
async function mergeUser(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) return;
  await db.$transaction(async (tx) => {
    // Plain foreign keys — no uniqueness to worry about.
    await tx.event.updateMany({ where: { hostId: fromId }, data: { hostId: toId } });
    await tx.comment.updateMany({ where: { userId: fromId }, data: { userId: toId } });

    // RSVP: @@unique([eventId, userId]).
    for (const r of await tx.rsvp.findMany({ where: { userId: fromId } })) {
      const clash = await tx.rsvp.findUnique({
        where: { eventId_userId: { eventId: r.eventId, userId: toId } },
      });
      if (clash) await tx.rsvp.delete({ where: { id: r.id } });
      else await tx.rsvp.update({ where: { id: r.id }, data: { userId: toId } });
    }

    // EventCohost: @@unique([eventId, userId]).
    for (const co of await tx.eventCohost.findMany({ where: { userId: fromId } })) {
      const clash = await tx.eventCohost.findUnique({
        where: { eventId_userId: { eventId: co.eventId, userId: toId } },
      });
      if (clash) await tx.eventCohost.delete({ where: { id: co.id } });
      else await tx.eventCohost.update({ where: { id: co.id }, data: { userId: toId } });
    }

    // Crush: @@unique([fromId, toId]); also guard against a self-crush the
    // merge would otherwise create (from and to becoming the same person).
    for (const cr of await tx.crush.findMany({ where: { fromId } })) {
      if (cr.toId === toId) {
        await tx.crush.delete({ where: { id: cr.id } });
        continue;
      }
      const clash = await tx.crush.findUnique({
        where: { fromId_toId: { fromId: toId, toId: cr.toId } },
      });
      if (clash) await tx.crush.delete({ where: { id: cr.id } });
      else await tx.crush.update({ where: { id: cr.id }, data: { fromId: toId } });
    }
    for (const cr of await tx.crush.findMany({ where: { toId: fromId } })) {
      if (cr.fromId === toId) {
        await tx.crush.delete({ where: { id: cr.id } });
        continue;
      }
      const clash = await tx.crush.findUnique({
        where: { fromId_toId: { fromId: cr.fromId, toId } },
      });
      if (clash) await tx.crush.delete({ where: { id: cr.id } });
      else await tx.crush.update({ where: { id: cr.id }, data: { toId } });
    }

    await tx.user.delete({ where: { id: fromId } });
  }, { timeout: 20000 });
}
