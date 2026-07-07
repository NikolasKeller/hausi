-- Allow an attendee to bring more than one +1 (up to min(plusOneLimit, 5),
-- enforced in the route layer). Previously a UNIQUE index on PlusOne.rsvpId
-- hard-limited each RSVP to a single +1. Drop it and replace with a plain index
-- so lookups by RSVP stay fast.
--
-- (This project applies schema changes with `prisma db push`; this file
-- documents the change and can be replayed by `prisma migrate`.)

-- DropIndex
DROP INDEX IF EXISTS "PlusOne_rsvpId_key";

-- CreateIndex
CREATE INDEX "PlusOne_rsvpId_idx" ON "PlusOne"("rsvpId");
