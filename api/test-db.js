import { prisma } from './_lib/db.js';

export async function GET() {
  try {
    // Test basic database connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    // Check if Hub table exists
    let hubTableExists = false;
    try {
      await prisma.hub.findFirst();
      hubTableExists = true;
    } catch (error) {
      hubTableExists = false;
    }
    
    // Check if HubMember table exists
    let hubMemberTableExists = false;
    try {
      await prisma.hubMember.findFirst();
      hubMemberTableExists = true;
    } catch (error) {
      hubMemberTableExists = false;
    }
    
    return new Response(JSON.stringify({
      status: 'success',
      databaseConnected: true,
      hubTableExists,
      hubMemberTableExists,
      testResult: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database test error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
