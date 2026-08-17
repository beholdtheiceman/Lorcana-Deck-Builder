-- Meta snapshots (MetaSnapshot / MetaArchetype / MetaMatchup): weekly aggregate
-- meta data pulled from external sources (duels.ink) plus first-party rollups.
-- DO NOT run `npx prisma db push` for this one: DATABASE_URL points at the live
-- production database and db push diffs the whole schema (it can drop drifted
-- columns/tables). This file is the explicit DDL, applied with
-- `npx prisma db execute --file prisma/meta_snapshots.sql --schema prisma/schema.prisma`.
-- Run ONCE (the ALTER ... ADD CONSTRAINT statements are not idempotent).
-- Requires no pre-existing tables; MetaSnapshot is created before its children.

CREATE TABLE IF NOT EXISTS "MetaSnapshot" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "queue" TEXT NOT NULL,
  "era" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "totalGames" INTEGER NOT NULL,
  "uniquePlayers" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "payload" JSONB NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaArchetype" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "archetypeId" TEXT,
  "name" TEXT NOT NULL,
  "colors" TEXT[],
  "games" INTEGER NOT NULL,
  "winRate" DOUBLE PRECISION NOT NULL,
  "playRate" DOUBLE PRECISION,
  "firstPlayerWinRate" DOUBLE PRECISION,
  "centroidCards" JSONB,
  "cardLift" JSONB,
  CONSTRAINT "MetaArchetype_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaMatchup" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "grain" TEXT NOT NULL,
  "keyA" TEXT NOT NULL,
  "keyB" TEXT NOT NULL,
  "games" INTEGER NOT NULL,
  "winRate" DOUBLE PRECISION NOT NULL,
  "firstPlayerWinRate" DOUBLE PRECISION,
  CONSTRAINT "MetaMatchup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetaSnapshot_source_queue_era_periodStart_key" ON "MetaSnapshot"("source", "queue", "era", "periodStart");
CREATE INDEX IF NOT EXISTS "MetaSnapshot_status_periodStart_idx" ON "MetaSnapshot"("status", "periodStart");

CREATE UNIQUE INDEX IF NOT EXISTS "MetaArchetype_snapshotId_externalId_key" ON "MetaArchetype"("snapshotId", "externalId");
CREATE INDEX IF NOT EXISTS "MetaArchetype_snapshotId_idx" ON "MetaArchetype"("snapshotId");

CREATE UNIQUE INDEX IF NOT EXISTS "MetaMatchup_snapshotId_grain_keyA_keyB_key" ON "MetaMatchup"("snapshotId", "grain", "keyA", "keyB");
CREATE INDEX IF NOT EXISTS "MetaMatchup_snapshotId_grain_idx" ON "MetaMatchup"("snapshotId", "grain");

ALTER TABLE "MetaArchetype" ADD CONSTRAINT "MetaArchetype_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MetaSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaMatchup"   ADD CONSTRAINT "MetaMatchup_snapshotId_fkey"   FOREIGN KEY ("snapshotId") REFERENCES "MetaSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
