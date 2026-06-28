-- Tournament result sync (M5): TournamentResult table.
-- EASIEST PATH: run `npx prisma db push` (reads prisma/schema.prisma, creates this table, no SQL needed).
-- This file is the explicit DDL alternative. Run ONCE (ALTER ... ADD CONSTRAINT is not idempotent).
-- Requires the Hub table to already exist.

CREATE TABLE IF NOT EXISTS "TournamentResult" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "addedById" TEXT,
  "source" TEXT NOT NULL,
  "externalId" TEXT,
  "eventName" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3),
  "playerName" TEXT,
  "deckArchetype" TEXT,
  "placement" INTEGER,
  "record" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentResult_hubId_source_externalId_key" ON "TournamentResult"("hubId", "source", "externalId");
CREATE INDEX IF NOT EXISTS "TournamentResult_hubId_eventDate_idx" ON "TournamentResult"("hubId", "eventDate");

ALTER TABLE "TournamentResult" ADD CONSTRAINT "TournamentResult_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
