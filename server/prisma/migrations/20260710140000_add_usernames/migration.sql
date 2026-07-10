ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Existing accounts receive a deterministic unique handle. Users can change
-- it from Edit Profile; new onboarding asks explicitly.
UPDATE "User"
SET "username" = 'user_' || lower(substr("id", -8))
WHERE "username" IS NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
