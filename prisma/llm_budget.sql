-- Self-serve AI budget guard (M3): LlmUsage ledger + Hub.llmMonthlyTokenBudget.
-- EASIEST PATH: run `npx prisma db push` (reads prisma/schema.prisma, applies these, no SQL needed).
-- This file is the explicit DDL alternative. Run ONCE (ALTER ... ADD CONSTRAINT is not idempotent).
-- Requires the Hub table to already exist.

ALTER TABLE "Hub" ADD COLUMN IF NOT EXISTS "llmMonthlyTokenBudget" INTEGER DEFAULT 500000;

CREATE TABLE IF NOT EXISTS "LlmUsage" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "userId" TEXT,
  "kind" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LlmUsage_hubId_createdAt_idx" ON "LlmUsage"("hubId", "createdAt");

ALTER TABLE "LlmUsage" ADD CONSTRAINT "LlmUsage_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
