import { prisma } from '../../_lib/db.js';
import { getSession } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      console.log('=== HUB DECKS API START ===');
      
      const session = getSession(req);
      if (!session) {
        console.log('No session found');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };
      console.log('User authenticated:', user.email);

      const { id: hubId } = req.query;
      console.log('Hub ID requested:', hubId);

      // Check if user is a member or owner of the hub
      console.log('Checking hub access...');
      const hub = await prisma.hub.findFirst({
        where: {
          id: hubId,
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } }
          ]
        }
      });

      if (!hub) {
        console.log('Hub access denied');
        return res.status(403).json({ error: 'Forbidden' });
      }
      console.log('Hub access granted:', hub.name);

      // Get all members of the hub (including owner)
      console.log('Fetching hub members...');
      const hubMembers = await prisma.hubMember.findMany({
        where: { hubId },
        select: { userId: true }
      });

      const memberIds = [
        hub.ownerId,
        ...hubMembers.map(member => member.userId)
      ];
      console.log('Member IDs:', memberIds);

      // Get all decks from hub members
      const decks = await prisma.deck.findMany({
        where: {
          userId: { in: memberIds }
        },
        include: {
          user: {
            select: { id: true, email: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      console.log('Raw decks from database:', decks.length);
      console.log('Member IDs we\'re searching for:', memberIds);
      console.log('Current user ID:', user.id);
      
      // Log deck ownership breakdown
      const decksByUser = {};
      decks.forEach(deck => {
        if (!decksByUser[deck.userId]) {
          decksByUser[deck.userId] = [];
        }
        decksByUser[deck.userId].push(deck.title);
      });
      
      console.log('Decks by user breakdown:');
      Object.keys(decksByUser).forEach(userId => {
        const userEmail = decks.find(d => d.userId === userId)?.user?.email || 'Unknown';
        console.log(`  ${userEmail} (${userId}): ${decksByUser[userId].length} decks - ${decksByUser[userId].join(', ')}`);
      });

      // Process decks to include basic info
      const processedDecks = decks.map((deck) => {
        const deckData = deck.data || {};
        
        // Get card count from deck data
        let cardCount = 0;
        if (deckData.entries && typeof deckData.entries === 'object') {
          // Sum up the count of each card entry to get total cards
          cardCount = Object.values(deckData.entries).reduce((total, entry) => {
            return total + (entry.count || 0);
          }, 0);
        } else if (deckData.total) {
          cardCount = deckData.total;
        }
        
        console.log(`Deck "${deck.title}" card count calculation:`, {
          entriesCount: Object.keys(deckData.entries || {}).length,
          totalCards: cardCount,
          deckDataTotal: deckData.total
        });
        
        return {
          ...deck,
          cardCount: cardCount
        };
      });

      console.log('Returning processed decks:', processedDecks.length);
      return res.status(200).json(processedDecks);
    } catch (error) {
      console.error('=== HUB DECKS API ERROR ===');
      console.error('Error fetching hub decks:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
