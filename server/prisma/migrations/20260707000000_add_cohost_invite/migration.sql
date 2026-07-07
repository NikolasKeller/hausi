-- Additive migration: adds the CohostInvite table for the phone-based co-host
-- invite + accept flow. New table only — no existing tables or columns are
-- renamed, altered, or dropped, so it is safe to apply to the live SQLite
-- volume. (This project applies schema changes with `prisma db push`; this file
-- documents the change and can be replayed by `prisma migrate`.)

-- CreateTable
CREATE TABLE "CohostInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CohostInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CohostInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CohostInvite_phone_idx" ON "CohostInvite"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CohostInvite_eventId_phone_key" ON "CohostInvite"("eventId", "phone");
