import { prisma } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting comments table migration...');

    // Create Comment table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Comment" (
        "id" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "deckId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
      );
    `;

    // Create indexes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Comment_deckId_idx" ON "Comment"("deckId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Comment_userId_idx" ON "Comment"("userId");`;

    console.log('Comments migration completed successfully');

    return res.status(200).json({
      status: 'success',
      message: 'Comments table created successfully',
      tableCreated: 'Comment'
    });

  } catch (error) {
    console.error('Comments migration failed:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
      stack: error.stack
    });
  }
}
