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
      console.log('Fetching decks for members...');
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
      console.log('Found decks:', decks.length);

      // Process decks to include card count and basic card info
      console.log('Processing deck data...');
      const processedDecks = decks.map((deck, index) => {
        try {
          console.log(`Processing deck ${index + 1}/${decks.length}:`, deck.id);
          
          const deckData = deck.data || {};
          console.log('Deck data type:', typeof deckData);
          console.log('Deck data keys:', Object.keys(deckData));
          
          // Try different possible card properties - the actual structure is deck.data.entries
          let cards = deckData.entries || deckData.Entries || deckData.cards || deckData.Cards || deckData.card || deckData.Card || [];
          
          // If entries is an object, convert it to an array of cards
          if (cards && typeof cards === 'object' && !Array.isArray(cards)) {
            console.log('Entries is an object, converting to array...');
            cards = Object.values(cards);
            console.log('Converted entries to array, length:', cards.length);
          }
          
          // If still no cards, check if it's a string that needs parsing
          if (!cards.length && typeof deckData === 'string') {
            try {
              const parsed = JSON.parse(deckData);
              cards = parsed.entries || parsed.Entries || parsed.cards || parsed.Cards || parsed.card || parsed.Card || [];
              // Handle case where parsed entries is also an object
              if (cards && typeof cards === 'object' && !Array.isArray(cards)) {
                cards = Object.values(cards);
              }
              console.log('Parsed from string:', parsed);
            } catch (e) {
              console.log('Failed to parse deck data as JSON');
            }
          }
          
          console.log('Final cards array length:', cards.length);
          
          // Debug: Log the first few cards to see their structure
          if (cards.length > 0) {
            console.log('First card structure:', cards[0]);
            console.log('First card keys:', Object.keys(cards[0]));
            console.log('Sample cards being created:', cards.slice(0, 3).map(card => ({
              name: card.name || card.Name || 'Unknown Card',
              ink: card.ink || card.Ink || 'Unknown',
              cost: card.cost || card.Cost || 0
            })));
          }
          
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
        } catch (deckError) {
          console.error('Error processing deck:', deck.id, deckError);
          // Return a safe fallback for this deck
          return {
            ...deck,
            cards: [],
            cardCount: 0,
            sampleCards: []
          };
        }
      });

      console.log('=== HUB DECKS API SUCCESS ===');
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
