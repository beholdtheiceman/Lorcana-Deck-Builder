import React, { useMemo } from "react";
import { calculateMonteCarloDrawOdds } from "../utils/monteCarloDrawOdds";

const DeckStats = ({ entries, focusCardName }) => {
  // Convert entries to individual cards for analysis (same pattern as in App.jsx)
  const cards = useMemo(() => 
    entries.flatMap(e => Array(e.count).fill(e.card))
  , [entries]);

  const totalCards = cards.length;
  const totalInkable = cards.filter((card) => card.inkable).length;
  const totalUninkable = totalCards - totalInkable;

  const inkablePercentage = totalCards > 0 ? ((totalInkable / totalCards) * 100).toFixed(1) : "0.0";
  const uninkablePercentage = totalCards > 0 ? ((totalUninkable / totalCards) * 100).toFixed(1) : "0.0";

  const averageCost = totalCards > 0 ? (
    cards.reduce((acc, card) => acc + (card.cost || 0), 0) / totalCards
  ).toFixed(1) : "0.0";

  const mostExpensive = cards.length > 0 ? cards.reduce(
    (prev, curr) => (curr.cost > prev.cost ? curr : prev),
    cards[0]
  ) : null;

  const cheapest = cards.length > 0 ? cards.reduce(
    (prev, curr) => (curr.cost < prev.cost ? curr : prev),
    cards[0]
  ) : null;

  const drawOddsByTurn = useMemo(() => {
    if (!focusCardName || cards.length === 0) {
      return {};
    }
    
    const targetCards = cards.filter(
      (card) => card.name === focusCardName
    );
    
    if (targetCards.length === 0) {
      return {};
    }
    
    return calculateMonteCarloDrawOdds(cards, targetCards, 5);
  }, [cards, focusCardName]);

  if (totalCards === 0) {
    return (
      <div className="p-4 bg-gray-900/30 border-b border-gray-800 text-white">
        <h2 className="text-lg font-semibold mb-2">Deck Stats</h2>
        <div className="text-gray-400">No cards in deck</div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900/30 border-b border-gray-800 text-white">
      <h2 className="text-lg font-semibold mb-2">Deck Stats</h2>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Total Cards: {totalCards}</div>
        <div>Inkable: {totalInkable} ({inkablePercentage}%)</div>
        <div>Uninkable: {totalUninkable} ({uninkablePercentage}%)</div>
        <div>Average Cost: {averageCost}</div>
        {mostExpensive && (
          <div>Most Expensive: {mostExpensive.name} (Cost {mostExpensive.cost})</div>
        )}
        {cheapest && (
          <div>Cheapest: {cheapest.name} (Cost {cheapest.cost})</div>
        )}
      </div>

      {focusCardName && Object.keys(drawOddsByTurn).length > 0 && (
        <>
          <h3 className="text-md font-semibold mt-4 mb-2">Draw Odds for {focusCardName}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(drawOddsByTurn).map(([turn, odds]) => (
              <div key={turn}>
                Turn {turn}: {odds.toFixed(1)}%
              </div>
            ))}
          </div>
        </>
      )}
      
      {focusCardName && Object.keys(drawOddsByTurn).length === 0 && (
        <div className="text-sm text-gray-400 mt-2">
          Card "{focusCardName}" not found in deck
        </div>
      )}
    </div>
  );
};

export default DeckStats;
