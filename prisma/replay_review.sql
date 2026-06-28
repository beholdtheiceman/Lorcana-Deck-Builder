-- Replay Review feature tables (Primer, Replay, Review).
-- EASIEST PATH: run `npx prisma db push` (reads prisma/schema.prisma, creates these tables, no SQL needed).
-- This file is the explicit DDL alternative. Run ONCE against the database (the ALTER ... ADD CONSTRAINT
-- statements are not idempotent). Requires the Hub and User tables to already exist.

CREATE TABLE IF NOT EXISTS "Primer" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "deckArchetype" TEXT NOT NULL,
  "vsArchetype" TEXT NOT NULL,
  "verdict" TEXT,
  "confidence" TEXT NOT NULL DEFAULT 'Draft',
  "gameplan" TEXT,
  "mustKill" TEXT,
  "mistakes" TEXT,
  "keyCards" JSONB NOT NULL DEFAULT '[]',
  "ownerId" TEXT,
  "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Primer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Replay" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "matchId" TEXT,
  "format" TEXT,
  "playerName" TEXT,
  "opponentName" TEXT,
  "matchResult" TEXT,
  "matchScore" TEXT,
  "parsed" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Replay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "replayId" TEXT,
  "primerId" TEXT,
  "authorId" TEXT,
  "generatedBy" TEXT NOT NULL DEFAULT 'llm',
  "gameNumber" INTEGER,
  "player" TEXT,
  "deckArchetype" TEXT,
  "vsArchetype" TEXT,
  "result" TEXT,
  "recap" TEXT NOT NULL,
  "lines" JSONB NOT NULL DEFAULT '[]',
  "leakTags" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Primer_hubId_deckArchetype_vsArchetype_key" ON "Primer"("hubId", "deckArchetype", "vsArchetype");
CREATE INDEX IF NOT EXISTS "Primer_hubId_idx" ON "Primer"("hubId");
CREATE INDEX IF NOT EXISTS "Replay_hubId_idx" ON "Replay"("hubId");
CREATE INDEX IF NOT EXISTS "Review_hubId_idx" ON "Review"("hubId");
CREATE INDEX IF NOT EXISTS "Review_replayId_idx" ON "Review"("replayId");

ALTER TABLE "Primer" ADD CONSTRAINT "Primer_hubId_fkey"      FOREIGN KEY ("hubId")      REFERENCES "Hub"("id")    ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Primer" ADD CONSTRAINT "Primer_ownerId_fkey"    FOREIGN KEY ("ownerId")    REFERENCES "User"("id")   ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_hubId_fkey"      FOREIGN KEY ("hubId")      REFERENCES "Hub"("id")    ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id")   ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_hubId_fkey"      FOREIGN KEY ("hubId")      REFERENCES "Hub"("id")    ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_replayId_fkey"   FOREIGN KEY ("replayId")   REFERENCES "Replay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_primerId_fkey"   FOREIGN KEY ("primerId")   REFERENCES "Primer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey"   FOREIGN KEY ("authorId")   REFERENCES "User"("id")   ON DELETE SET NULL ON UPDATE CASCADE;
