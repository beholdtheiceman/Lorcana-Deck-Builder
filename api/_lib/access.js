import { prisma } from "./db.js";

/**
 * Returns true if `userId` may view/comment on `deckId`:
 *  - they own the deck, OR
 *  - they share at least one hub with the deck's owner.
 * Returns false if the deck does not exist.
 */
export async function canAccessDeck(userId, deckId) {
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { userId: true },
  });
  if (!deck) return false;
  if (deck.userId === userId) return true;

  const sharedHub = await prisma.hub.findFirst({
    where: {
      AND: [
        { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        { OR: [{ ownerId: deck.userId }, { members: { some: { userId: deck.userId } } }] },
      ],
    },
    select: { id: true },
  });
  return Boolean(sharedHub);
}
