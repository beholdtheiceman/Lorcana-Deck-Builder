-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_createdById_fkey";

-- DropForeignKey
ALTER TABLE "MetaReport" DROP CONSTRAINT "MetaReport_authorId_fkey";

-- DropForeignKey
ALTER TABLE "PlaytestGame" DROP CONSTRAINT "PlaytestGame_loggedById_fkey";

-- DropForeignKey
ALTER TABLE "Practice" DROP CONSTRAINT "Practice_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Replay" DROP CONSTRAINT "Replay_uploaderId_fkey";

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MetaReport" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlaytestGame" ALTER COLUMN "loggedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Practice" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Replay" ALTER COLUMN "uploaderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaytestGame" ADD CONSTRAINT "PlaytestGame_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaReport" ADD CONSTRAINT "MetaReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

