import { prisma } from "./_lib/db.js";

export default async function handler(req, res) {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test if we can access the User table
    const userCount = await prisma.user.count();
    
    return res.json({ 
      success: true, 
      message: "Database connection successful",
      userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test failed:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}
