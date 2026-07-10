ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Event" ADD COLUMN "publicationStatus" TEXT NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "Event" ADD COLUMN "hideLocation" BOOLEAN NOT NULL DEFAULT false;

-- Everything already discoverable before moderation existed remains approved.
UPDATE "Event"
SET "publicationStatus" = 'APPROVED'
WHERE "isPublic" = true;
