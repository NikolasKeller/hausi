-- CreateTable
CREATE TABLE "TicketJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'checking',
    "provider" TEXT NOT NULL DEFAULT 'demo',
    "pdfPath" TEXT NOT NULL DEFAULT '',
    "buyerName" TEXT NOT NULL DEFAULT '',
    "cardLast4" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TicketJob_userId_idx" ON "TicketJob"("userId");

-- CreateIndex
CREATE INDEX "TicketJob_eventId_userId_idx" ON "TicketJob"("eventId", "userId");
