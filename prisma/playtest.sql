-- Playtest & Matchup tracking (PlaytestGame).
-- EASIEST PATH: run `npx prisma db push` (reads prisma/schema.prisma, creates this table, no SQL needed).
-- This file is the explicit DDL alternative. Run ONCE against the database (the ALTER ... ADD CONSTRAINT
-- statements are not idempotent). Requires the Hub, User, and Deck tables to already exist.

CREATE TABLE IF NOT EXISTS "PlaytestGame" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "loggedById" TEXT NOT NULL,
  "deckId" TEXT,
  "deckArchetype" TEXT NOT NULL,
  "vsArchetype" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "onPlay" BOOLEAN,
  "format" TEXT,
  "lesson" TEXT,
  "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaytestGame_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlaytestGame_hubId_idx" ON "PlaytestGame"("hubId");
CREATE INDEX IF NOT EXISTS "PlaytestGame_hubId_deckArchetype_vsArchetype_idx" ON "PlaytestGame"("hubId", "deckArchetype", "vsArchetype");

ALTER TABLE "PlaytestGame" ADD CONSTRAINT "PlaytestGame_hubId_fkey"      FOREIGN KEY ("hubId")      REFERENCES "Hub"("id")  ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "PlaytestGame" ADD CONSTRAINT "PlaytestGame_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlaytestGame" ADD CONSTRAINT "PlaytestGame_deckId_fkey"     FOREIGN KEY ("deckId")     REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
