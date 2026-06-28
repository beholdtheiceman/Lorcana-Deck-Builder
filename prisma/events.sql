-- Events + Discord bridge (M4): Event table and Hub.discordWebhookUrl column.
-- EASIEST PATH: run `npx prisma db push` (reads prisma/schema.prisma, applies these, no SQL needed).
-- This file is the explicit DDL alternative. Run ONCE (ALTER ... ADD CONSTRAINT is not idempotent).
-- Requires the Hub and User tables to already exist.

ALTER TABLE "Hub" ADD COLUMN IF NOT EXISTS "discordWebhookUrl" TEXT;

CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "kind" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Event_hubId_idx" ON "Event"("hubId");
CREATE INDEX IF NOT EXISTS "Event_hubId_startsAt_idx" ON "Event"("hubId", "startsAt");

ALTER TABLE "Event" ADD CONSTRAINT "Event_hubId_fkey"       FOREIGN KEY ("hubId")       REFERENCES "Hub"("id")  ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
