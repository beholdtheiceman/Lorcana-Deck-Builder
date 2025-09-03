import React, { useMemo, useState } from "react";
import { calculateMonteCarloDrawOdds } from "../utils/monteCarloDrawOdds";

// Turn Selector Component
function TurnSelector({ value, min = 1, max = 10, onChange }) {
  return (
    <label className="turn-selector" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontWeight: 600, color: "#9CA3AF" }}>Turn</span>
      <select
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #374151",
          background: "#1F2937",
          color: "#F9FAFB",
          fontSize: 14,
        }}
      >
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </label>
  );
}

const DeckStats = ({ entries, focusCardName = "" }) => {
  // Force rebuild to clear browser cache - v3
  console.log('DeckStats component loaded with focusCardName:', focusCardName);
  
  // Local state for the selected turn
  const [targetTurn, setTargetTurn] = useState(3);
  
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

  // Small adapter that calls the existing Monte Carlo function
  const computeByTurnOdds = useMemo(() => {
    if (!focusCardName || cards.length === 0) {
      return null;
    }
    
    const targetCards = cards.filter(
      (card) => card.name === focusCardName
    );
    
    if (targetCards.length === 0) {
      return null;
    }
    
    // Use the existing Monte Carlo function with the selected turn
    return calculateMonteCarloDrawOdds(cards, targetCards, targetTurn);
  }, [cards, focusCardName, targetTurn]);

  // Convert to percentage for display
  const drawOddsPercent = useMemo(() => {
    if (computeByTurnOdds && typeof computeByTurnOdds === 'object') {
      // If it returns an object with probability property
      if (typeof computeByTurnOdds.probability === 'number') {
        return Math.round(computeByTurnOdds.probability * 1000) / 10; // e.g., 52.3
      }
      // If it returns an object with the turn as key
      const turnOdds = computeByTurnOdds[targetTurn];
      if (typeof turnOdds === 'number') {
        return Math.round(turnOdds * 1000) / 10;
      }
    }
    // If it returns a raw number 0..1
    if (typeof computeByTurnOdds === 'number') {
      return Math.round(computeByTurnOdds * 1000) / 10;
    }
    return null;
  }, [computeByTurnOdds, targetTurn]);

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

      {focusCardName && (
        <>
          <h3 className="text-md font-semibold mt-4 mb-2">Draw Odds for {focusCardName}</h3>
          
          {/* Turn Selector Controls */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <TurnSelector value={targetTurn} onChange={setTargetTurn} min={1} max={10} />
            <div style={{ opacity: 0.7, fontSize: 13, color: "#9CA3AF" }}>
              Select the turn to evaluate draw odds.
            </div>
          </div>
          
          {/* Turn-specific odds display */}
          <div style={{ marginTop: 6 }}>
            {drawOddsPercent == null ? (
              <span style={{ opacity: 0.7, color: "#9CA3AF" }}>Odds: —</span>
            ) : (
              <span style={{ color: "#10B981", fontWeight: 600 }}>
                <strong>Odds by Turn {targetTurn}:</strong> {drawOddsPercent}%
              </span>
            )}
          </div>
          
          {!focusCardName && (
            <div className="text-sm text-gray-400 mt-2">
              Select a focus card to see draw odds
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DeckStats;
