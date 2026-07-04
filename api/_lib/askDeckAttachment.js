// api/_lib/askDeckAttachment.js
//
// Shared "attach a deck to this Ask AI question" resolver, used by both
// /api/ask and /api/hubs/[id]/ask. A deck can be attached either by
// referencing a saved Deck (deckId) or by pasting a raw list (text); either
// way it's rendered into a compact deck section that gets prepended to the
// question before it reaches the agent, so every tool call in that turn has
// the deck's actual contents in view.

import { prisma } from "./db.js";
import { summarizeNamedCards, namedPairsFromDeckData, renderDeckSection } from "./deckContext.js";
import { parseDeckText } from "./deckTextParse.js";

/**
 * @param {{deckId?: string} | {text?: string} | undefined} deck
 * @param {{userId: string, hubId?: string|null}} ctx  hubId, when given, also
 *   allows attaching a teammate's deck (any hub member's saved deck), not
 *   just the requester's own.
 * @returns {Promise<
 *   { error: string, status: number, deckWarnings?: string[] } |
 *   { deckSection: string|null, deckWarnings: string[] }
 * >}
 */
export async function resolveDeckAttachment(deck, { userId, hubId }) {
  if (!deck) return { deckSection: null, deckWarnings: [] };

  let pairs;
  let deckLabel;

  if (deck.deckId) {
    const deckRow = await prisma.deck.findUnique({
      where: { id: deck.deckId },
      select: { title: true, data: true, userId: true },
    });
    if (!deckRow) return { error: "Deck not found", status: 404 };

    let allowed = deckRow.userId === userId;
    if (!allowed && hubId) {
      const inHub = await prisma.hub.findFirst({
        where: { id: hubId, OR: [{ ownerId: deckRow.userId }, { members: { some: { userId: deckRow.userId } } }] },
        select: { id: true },
      });
      allowed = Boolean(inHub);
    }
    if (!allowed) return { error: "You don't have access to that deck", status: 403 };

    pairs = namedPairsFromDeckData(deckRow.data);
    deckLabel = deckRow.title;
  } else if (deck.text) {
    const parsedText = parseDeckText(deck.text);
    if (parsedText.error) return { error: parsedText.error, status: 400 };
    pairs = parsedText.pairs;
    deckLabel = "Pasted list";
  } else {
    return { deckSection: null, deckWarnings: [] };
  }

  const { summary, warnings } = summarizeNamedCards(pairs);
  if (!summary) {
    return { error: "No cards in that deck list could be recognized.", status: 400, deckWarnings: warnings };
  }

  return { deckSection: renderDeckSection(summary, `ATTACHED DECK: ${deckLabel}`), deckWarnings: warnings };
}
