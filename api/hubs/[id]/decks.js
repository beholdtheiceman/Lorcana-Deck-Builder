import { prisma } from '../../_lib/db.js';
import { getSession } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const user = { id: session.uid, email: session.email };

      const { id: hubId } = req.query;

      // Check if user is a member or owner of the hub
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
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Get all members of the hub (including owner)
      const hubMembers = await prisma.hubMember.findMany({
        where: { hubId },
        select: { userId: true }
      });

      const memberIds = [
        hub.ownerId,
        ...hubMembers.map(member => member.userId)
      ];

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

      // Process decks to include card count and basic card info
      const processedDecks = decks.map(deck => {
        const deckData = deck.data || {};
        
        // Debug logging - check all possible card properties
        console.log('=== DECK DEBUG ===');
        console.log('Deck ID:', deck.id);
        console.log('Deck Title:', deck.title);
        console.log('Full deck data:', JSON.stringify(deck, null, 2));
        console.log('Deck.data:', JSON.stringify(deckData, null, 2));
        
        // Try different possible card properties - the actual structure is deck.data.entries
        let cards = deckData.entries || deckData.Entries || deckData.cards || deckData.Cards || deckData.card || deckData.Card || [];
        
        // If still no cards, check if it's a string that needs parsing
        if (!cards.length && typeof deckData === 'string') {
          try {
            const parsed = JSON.parse(deckData);
            cards = parsed.entries || parsed.Entries || parsed.cards || parsed.Cards || parsed.card || parsed.Card || [];
            console.log('Parsed from string:', parsed);
          } catch (e) {
            console.log('Failed to parse deck data as JSON');
          }
        }
        
        console.log('Final cards array:', cards);
        console.log('Card count:', cards.length);
        console.log('==================');
        
        return {
          ...deck,
          cards: cards,
          cardCount: cards.length,
          // Add some basic card info for display
          sampleCards: cards.slice(0, 3).map(card => ({
            name: card.name || card.Name || 'Unknown Card',
            ink: card.ink || card.Ink || 'Unknown',
            cost: card.cost || card.Cost || 0
          }))
        };
      });

      return res.status(200).json(processedDecks);
    } catch (error) {
      console.error('Error fetching hub decks:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
