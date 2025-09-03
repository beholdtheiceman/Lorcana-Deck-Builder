// Monte Carlo simulation for draw probability calculations
export const calculateMonteCarloDrawOdds = (deckCards, targetCards, maxTurns = 5, simulations = 10000) => {
  if (!deckCards || deckCards.length === 0 || !targetCards || targetCards.length === 0) {
    return {};
  }

  // Create a flat array of all cards in the deck
  const flatDeck = [];
  deckCards.forEach(card => {
    // Assuming each card object has a count property or we need to determine copies
    const copies = card.count || 1;
    for (let i = 0; i < copies; i++) {
      flatDeck.push(card);
    }
  });

  const deckSize = flatDeck.length;
  const targetCardNames = targetCards.map(card => card.name);
  
  // Count target cards in deck
  const targetCardCount = flatDeck.filter(card => targetCardNames.includes(card.name)).length;
  
  if (targetCardCount === 0) {
    return {};
  }

  const results = {};

  // Simulate for each turn
  for (let turn = 1; turn <= maxTurns; turn++) {
    let hits = 0;
    const cardsDrawn = 7 + (turn - 1); // Opening hand + draws per turn

    for (let sim = 0; sim < simulations; sim++) {
      // Create a copy of the deck and shuffle
      const shuffledDeck = [...flatDeck];
      
      // Fisher-Yates shuffle
      for (let i = shuffledDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
      }

      // Draw cards for this turn
      const drawnCards = shuffledDeck.slice(0, Math.min(cardsDrawn, deckSize));
      
      // Check if any target card was drawn
      const hasTargetCard = drawnCards.some(card => targetCardNames.includes(card.name));
      
      if (hasTargetCard) {
        hits++;
      }
    }

    results[turn] = (hits / simulations) * 100;
  }

  return results;
};

// Alternative function for single card draw odds
export const calculateSingleCardDrawOdds = (deckCards, targetCardName, maxTurns = 5, simulations = 10000) => {
  const targetCard = { name: targetCardName };
  return calculateMonteCarloDrawOdds(deckCards, [targetCard], maxTurns, simulations);
};
