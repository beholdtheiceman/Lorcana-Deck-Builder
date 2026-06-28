// src/data/seedPrimer.js
// Seed Strategy Primer used to bootstrap a hub's "Blurple Control vs Go-Wide Dogs"
// matchup page. The card-grounded *facts* below are sourced from the cards
// themselves (lore scaling, recursion, evasion). The strategy *judgments*
// (verdict, lines of play, mulligan calls) are explicitly marked DRAFT and are
// meant to be edited/confirmed by the hub before being trusted.
//
// Shape mirrors the Primer model (minus server-managed fields like id/hubId).

const seedPrimer = {
  deckArchetype: "Blurple Control",
  vsArchetype: "Go-Wide Dogs",
  // Strategy judgment — unverified until a human reviews the matchup.
  verdict: "Even", // DRAFT
  confidence: "Draft",

  gameplan: [
    "DRAFT (strategy judgment — confirm before trusting):",
    "Treat this as a damage race you win on the back of card quality, not tempo.",
    "Go-Wide Dogs flood the board and lean on Lady - Decisive Dog, whose lore",
    "value scales with how many other Puppy/Dog characters you have in play — so",
    "the longer the board stays wide, the faster she quests for lethal lore. Your",
    "win condition is to keep the dog board small: trade or remove aggressively",
    "early, then stabilize and grind them out once their go-wide engine is empty.",
    "Elsa (1-cost, 1 lore, Evasive) is a cheap, repeatable lore-leaker they use to",
    "chip in while you're tapped out on removal — only non-Evasive characters can",
    "challenge her, so plan to answer her with removal/songs, not bodies.",
  ].join(" "),

  mustKill: [
    "DRAFT (priorities — confirm targets):",
    "1) Lady - Decisive Dog: her lore scales with the number of other dogs in play,",
    "   so she snowballs the wider their board gets. Kill her before they build the",
    "   board around her, not after.",
    "2) Miss Park Avenue (Lady): she recurs go-wide threats from the discard back to",
    "   hand, refilling the swarm after you spend removal — so removing her blunts",
    "   their recursion engine and makes your sweepers stick.",
    "3) Lilo: recurs an exerted character (brings an exerted body back), letting them",
    "   re-deploy a quester you thought you'd dealt with — track which body she can",
    "   return and sequence your removal so it isn't undone.",
    "4) Elsa (1 lore, Evasive): low priority to kill but must be answered with",
    "   evasive-capable removal/songs since bodies can't challenge her.",
  ].join(" "),

  mistakes: [
    "DRAFT (common misplays — confirm):",
    "- Letting the dog board go wide before answering Lady - Decisive Dog: her lore",
    "  scaling means every extra dog you ignore is extra lore per turn off her.",
    "- Spending removal on the swarm while Miss Park Avenue is live — she just",
    "  recurs the threats back, so you net zero. Kill the recursion first.",
    "- Forgetting Lilo can recur an *exerted* character: don't assume an exerted",
    "  quester is 'dealt with' until Lilo is gone.",
    "- Trying to block Elsa with a non-Evasive body (she has Evasive, so she can't",
    "  be challenged by it) and leaking the turn instead of removing her.",
    "- Over-trading your removal early and running dry before their late refills.",
  ].join(" "),

  // Card-grounded facts attached to each key card (note = the relevant fact).
  keyCards: [
    {
      id: null,
      name: "Lady - Decisive Dog",
      note: "Lore scales with the number of other Dog/Puppy characters in play — snowballs as their board goes wide. Primary removal target.",
    },
    {
      id: null,
      name: "Lady - Miss Park Avenue",
      note: "Recurs go-wide threats from discard back to hand; refills the swarm after you spend removal. Kill the recursion before sweeping.",
    },
    {
      id: null,
      name: "Lilo - Galactic Hero",
      note: "Recurs an exerted character (returns an exerted body), so an exerted quester isn't safely 'dealt with' until Lilo is gone.",
    },
    {
      id: null,
      name: "Elsa - Gloves Off",
      note: "1 lore, Evasive — only Evasive characters can challenge her. A cheap repeatable lore-leak; answer with evasive removal/songs, not bodies.",
    },
  ],

  // Server sets lastReviewedAt; included here so a fresh seed reads as just-reviewed.
  lastReviewedAt: new Date().toISOString(),
};

export default seedPrimer;
export { seedPrimer };
