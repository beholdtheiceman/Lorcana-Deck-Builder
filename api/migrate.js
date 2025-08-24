import { prisma } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting database migration...');

    // Create Hub table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Hub" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "inviteCode" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
      );
    `;

    // Create HubMember table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "HubMember" (
        "id" TEXT NOT NULL,
        "hubId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HubMember_pkey" PRIMARY KEY ("id")
      );
    `;

    // Create indexes
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Hub_inviteCode_key" ON "Hub"("inviteCode");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Hub_ownerId_idx" ON "Hub"("ownerId");`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "HubMember_hubId_userId_key" ON "HubMember"("hubId", "userId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "HubMember_hubId_idx" ON "HubMember"("hubId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "HubMember_userId_idx" ON "HubMember"("userId");`;

    console.log('Migration completed successfully');

    return res.status(200).json({
      status: 'success',
      message: 'Database tables created successfully',
      tablesCreated: ['Hub', 'HubMember']
    });

  } catch (error) {
    console.error('Migration failed:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
      stack: error.stack
    });
  }
}
