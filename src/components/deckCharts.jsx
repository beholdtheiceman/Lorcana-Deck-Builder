// Deck analysis widgets: curve chart, draw-probability + mulligan simulator,
// hoverable stat lines/boxes. Extracted verbatim from App.jsx (H9).
import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";

// Enhanced Curve Chart with Meta Comparison
function EnhancedCurveChart({ data }) {
  const [showMeta, setShowMeta] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState('midrange');
  
  const archetypes = ['aggro', 'midrange', 'control', 'ramp'];
  const archetypeColors = {
    aggro: '#ef4444',
    midrange: '#3b82f6', 
    control: '#8b5cf6',
    ramp: '#10b981'
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox"
            id="show-meta"
            checked={showMeta}
            onChange={(e) => setShowMeta(e.target.checked)}
            className="rounded bg-gray-800 border-white/10"
          />
          <label htmlFor="show-meta" className="text-gray-300">Show meta curve</label>
        </div>
        
        {showMeta && (
          <select 
            value={selectedArchetype}
            onChange={(e) => setSelectedArchetype(e.target.value)}
            className="bg-gray-800 rounded px-2 py-1 text-xs border border-white/10"
          >
            {archetypes.map(arch => (
              <option key={arch} value={arch}>
                {arch.charAt(0).toUpperCase() + arch.slice(1)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="cost" />
          <YAxis allowDecimals={false} />
          <Tooltip content={({ active, payload, label }) => {
            if (active && payload && payload.length > 0) {
              const data = payload[0].payload;
              return (
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
                  <p className="text-white font-semibold">Cost {label}</p>
                  <p className="text-emerald-400">Inkable: {data.inkable}</p>
                  <p className="text-amber-400">Uninkable: {data.uninkable}</p>
                  <p className="text-gray-300">Total: {data.total}</p>
                  {showMeta && (
                    <p className="text-blue-400 mt-1">
                      Meta ({selectedArchetype}): {Math.round(data[`meta_${selectedArchetype}`] || 0)}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }} />
          <Legend />
          <Bar dataKey="inkable" stackId="deck" fill="#10b981" name="Inkable" />
          <Bar dataKey="uninkable" stackId="deck" fill="#f59e0b" name="Uninkable" />
          {showMeta && (
            <Bar 
              dataKey={`meta_${selectedArchetype}`} 
              fill={archetypeColors[selectedArchetype]} 
              fillOpacity={0.4}
              stroke={archetypeColors[selectedArchetype]}
              strokeWidth={2}
              name={`Meta ${selectedArchetype.charAt(0).toUpperCase() + selectedArchetype.slice(1)}`}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
      
      {showMeta && (
        <div className="text-xs text-gray-400 mt-2">
          Meta curve scaled to your deck size. Overlay shows ideal distribution for {selectedArchetype} archetype.
        </div>
      )}
    </div>
  );
}

// Draw Probability Calculator Component
function DrawProbabilityTool({ deck }) {
  const [selectedCard, setSelectedCard] = useState('');
  const [targetTurn, setTargetTurn] = useState(4);
  const [withMulligan, setWithMulligan] = useState(true);
  const [mulliganCount, setMulliganCount] = useState(3);
  const [useMonteCarloSim, setUseMonteCarloSim] = useState(false);
  const [simulations, setSimulations] = useState(10000);

  // Calculate hypergeometric probability
  const calculateDrawProbability = (cardCopies, deckSize, handSize, targetTurn) => {
    if (cardCopies === 0 || deckSize === 0) return 0;
    
    // Total cards drawn by target turn (opening hand + draws)
    const totalDrawn = handSize + (targetTurn - 1); // Turn 1 = 7 cards, Turn 2 = 8 cards, etc.
    const maxDrawn = Math.min(totalDrawn, deckSize);
    
    // Probability of NOT drawing the card (hypergeometric)
    let probabilityOfNotDrawing = 1;
    const cardsNotInDeck = deckSize - cardCopies;
    
    for (let i = 0; i < maxDrawn; i++) {
      probabilityOfNotDrawing *= (cardsNotInDeck - i) / (deckSize - i);
    }
    
    return (1 - probabilityOfNotDrawing) * 100; // Convert to percentage
  };

  // Monte Carlo simulation for complex scenarios
  const simulateDrawProbability = ({
    deckSize = 60,
    copiesInDeck = 4,
    handSize = 7,
    cardsDrawnPerTurn = 1,
    turnCount = 3,
    mulliganCount = 0,
    simulations = 10000,
  }) => {
    let hits = 0;

    for (let i = 0; i < simulations; i++) {
      // Create deck array
      let deck = Array(deckSize).fill('other');
      for (let j = 0; j < copiesInDeck; j++) {
        deck[j] = 'target';
      }

      // Fisher-Yates shuffle
      for (let k = deck.length - 1; k > 0; k--) {
        const rand = Math.floor(Math.random() * (k + 1));
        [deck[k], deck[rand]] = [deck[rand], deck[k]];
      }

      // Initial hand draw
      let hand = deck.slice(0, handSize);
      let deckIndex = handSize;
      let allCardsSeen = [...hand]; // Track all unique cards seen

      // Mulligan logic (replace specified number of cards)
      if (mulliganCount > 0 && deckIndex + mulliganCount <= deckSize) {
        const mulliganedCards = hand.slice(0, mulliganCount); // Cards we're mulliganing away
        const newCards = deck.slice(deckIndex, deckIndex + mulliganCount);
        hand = hand.slice(mulliganCount).concat(newCards);
        allCardsSeen = allCardsSeen.concat(newCards); // Add new cards to total seen
        deckIndex += mulliganCount;
        // Note: mulliganedCards are already in allCardsSeen from initial hand
      }

      // Draw cards for additional turns
      const additionalDraws = Math.min((turnCount - 1) * cardsDrawnPerTurn, deckSize - deckIndex);
      const turnDraws = deck.slice(deckIndex, deckIndex + additionalDraws);
      allCardsSeen = allCardsSeen.concat(turnDraws);

      // Check if target card is present
      if (allCardsSeen.includes('target')) {
        hits++;
      }
    }

    return (hits / simulations) * 100;
  };

  // Get deck data
  const deckSize = deck.reduce((sum, entry) => sum + entry.count, 0);
  const uniqueCards = deck.map(entry => ({
    name: entry.card.name,
    copies: entry.count
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Find selected card copies
  const selectedCardData = deck.find(entry => entry.card.name === selectedCard);
  const cardCopies = selectedCardData ? selectedCardData.count : 0;

  // Calculate probabilities using selected method
  let openingHandProb, targetTurnProb;
  
  if (useMonteCarloSim) {
    // Monte Carlo simulation
    openingHandProb = simulateDrawProbability({
      deckSize,
      copiesInDeck: cardCopies,
      handSize: 7,
      turnCount: 1,
      mulliganCount: 0,
      simulations
    });
    
    targetTurnProb = simulateDrawProbability({
      deckSize,
      copiesInDeck: cardCopies,
      handSize: 7,
      turnCount: targetTurn,
      mulliganCount: 0,
      simulations
    });
  } else {
    // Hypergeometric calculation
    openingHandProb = calculateDrawProbability(cardCopies, deckSize, 7, 1);
    targetTurnProb = calculateDrawProbability(cardCopies, deckSize, 7, targetTurn);
  }
  
  // Advanced mulligan calculation with partial mulligan support
  let finalProb = targetTurnProb;
  
  if (withMulligan && mulliganCount > 0) {
    if (useMonteCarloSim) {
      // Use Monte Carlo simulation for mulligan
      finalProb = simulateDrawProbability({
        deckSize,
        copiesInDeck: cardCopies,
        handSize: 7,
        turnCount: targetTurn,
        mulliganCount,
        simulations
      });
    } else {
      // Hypergeometric calculation for partial mulligan
      const cardsKept = 7 - mulliganCount;
      const cardsDrawn = mulliganCount;
      
      // Scenario 1: Card is in the cards you keep (don't mulligan)
      const probInKept = calculateDrawProbability(cardCopies, deckSize, cardsKept, 1);
      
      // Scenario 2: Card is NOT in kept cards, but you draw it in mulligan
      const probNotInKept = 100 - probInKept;
      const remainingCopies = cardCopies; // Still all copies available for mulligan draw
      const remainingDeckSize = deckSize - cardsKept; // Cards available for mulligan
      const probInMulligan = calculateDrawProbability(remainingCopies, remainingDeckSize, cardsDrawn, 1);
      
      // Combined probability after opening + mulligan
      const probAfterMulligan = probInKept + (probNotInKept/100 * probInMulligan);
      
      // Continue to target turn if needed
      const remainingTurns = targetTurn - 1;
      if (remainingTurns > 0) {
        // Calculate probability of drawing in remaining turns
        const noCardAfterMulligan = (100 - probAfterMulligan) / 100;
        const cardsSeenSoFar = 7 + mulliganCount; // Total unique cards seen (original + mulligan)
        const remainingDeckForDraw = deckSize - cardsSeenSoFar;
        const remainingDrawProb = calculateDrawProbability(cardCopies, remainingDeckForDraw, remainingTurns, 1);
        
        finalProb = probAfterMulligan + (noCardAfterMulligan * remainingDrawProb);
      } else {
        finalProb = probAfterMulligan;
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-300 mb-3">
        Calculate the probability of drawing a specific card by a target turn.
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* Card Selection */}
        <div>
          <label className="block text-xs uppercase text-gray-400 mb-1">Select Card</label>
          <select 
            className="w-full bg-gray-800 rounded px-2 py-1 text-sm border border-white/10"
            value={selectedCard}
            onChange={(e) => setSelectedCard(e.target.value)}
          >
            <option value="">Choose a card...</option>
            {uniqueCards.map(card => (
              <option key={card.name} value={card.name}>
                {card.name} ({card.copies}x)
              </option>
            ))}
          </select>
        </div>

        {/* Turn Selection */}
        <div>
          <label className="block text-xs uppercase text-gray-400 mb-1">Target Turn</label>
          <select 
            className="w-full bg-gray-800 rounded px-2 py-1 text-sm border border-white/10"
            value={targetTurn}
            onChange={(e) => setTargetTurn(parseInt(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map(turn => (
              <option key={turn} value={turn}>
                Turn {turn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mulligan Options */}
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <input 
            type="checkbox" 
            id="mulligan" 
            checked={withMulligan}
            onChange={(e) => setWithMulligan(e.target.checked)}
            className="rounded bg-gray-800 border-white/10"
          />
          <label htmlFor="mulligan" className="text-sm text-gray-300">
            Include mulligan opportunity
          </label>
        </div>
        
        {withMulligan && (
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">
              Cards to Mulligan
            </label>
            <select 
              className="w-full bg-gray-800 rounded px-2 py-1 text-sm border border-white/10"
              value={mulliganCount}
              onChange={(e) => setMulliganCount(parseInt(e.target.value))}
            >
              {Array.from({length: 7}, (_, i) => i + 1).map(count => (
                <option key={count} value={count}>
                  {count} card{count !== 1 ? 's' : ''} ({7 - count} kept)
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-400 mt-1">
              Assumes optimal mulligan decision for target card
            </div>
          </div>
        )}
      </div>

      {/* Monte Carlo Simulation Options */}
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <input 
            type="checkbox" 
            id="monte-carlo" 
            checked={useMonteCarloSim}
            onChange={(e) => setUseMonteCarloSim(e.target.checked)}
            className="rounded bg-gray-800 border-white/10"
          />
          <label htmlFor="monte-carlo" className="text-sm text-gray-300">
            🎲 Use Monte Carlo simulation
          </label>
        </div>
        
        {useMonteCarloSim && (
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">
              Number of Simulations
            </label>
            <select 
              className="w-full bg-gray-800 rounded px-2 py-1 text-sm border border-white/10"
              value={simulations}
              onChange={(e) => setSimulations(parseInt(e.target.value))}
            >
              <option value={1000}>1,000 (Fast)</option>
              <option value={10000}>10,000 (Balanced)</option>
              <option value={50000}>50,000 (Accurate)</option>
              <option value={100000}>100,000 (High Precision)</option>
            </select>
            <div className="text-xs text-gray-400 mt-1">
              Higher simulation count = more accurate results but slower calculation
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {selectedCard && (
        <div className="bg-gray-700 rounded-lg p-4 mt-4">
          <h4 className="font-semibold mb-3 text-emerald-300">
            Probability Results for "{selectedCard}" {useMonteCarloSim ? '🎲' : '🧮'}
          </h4>
          <div className="text-xs text-gray-400 mb-3">
            {useMonteCarloSim ? 
              `Monte Carlo simulation with ${simulations.toLocaleString()} runs` : 
              'Hypergeometric probability calculation'
            }
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {openingHandProb.toFixed(1)}%
              </div>
              <div className="text-gray-400">Opening Hand</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {targetTurnProb.toFixed(1)}%
              </div>
              <div className="text-gray-400">By Turn {targetTurn}</div>
            </div>
            {withMulligan && (
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {finalProb.toFixed(1)}%
                </div>
                <div className="text-gray-400">
                  With Mulligan ({mulliganCount} cards)
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-3 text-xs text-gray-400">
            <div>• Deck size: {deckSize} cards</div>
            <div>• Copies in deck: {cardCopies}</div>
            <div>• Cards drawn by turn {targetTurn}: {Math.min(7 + (targetTurn - 1), deckSize)}</div>
            {withMulligan && (
              <div>• Mulligan strategy: Keep {7 - mulliganCount}, redraw {mulliganCount}</div>
            )}
          </div>
          
          {/* Turn-by-Turn Probability Curve */}
          <div className="mt-4 pt-4 border-t border-gray-600">
            <h5 className="text-sm font-semibold mb-3 text-emerald-300">📈 Probability Curve (Turn 1-10)</h5>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(() => {
                  // Generate curve data for turns 1-10
                  const curveData = [];
                  for (let turn = 1; turn <= 10; turn++) {
                    let baseProb, probWithMulligan;
                    
                    if (useMonteCarloSim) {
                      // Monte Carlo simulation for curve
                      baseProb = simulateDrawProbability({
                        deckSize,
                        copiesInDeck: cardCopies,
                        handSize: 7,
                        turnCount: turn,
                        mulliganCount: 0,
                        simulations: Math.min(simulations, 5000) // Limit for performance
                      });
                      probWithMulligan = baseProb;
                    } else {
                      // Hypergeometric calculation
                      baseProb = calculateDrawProbability(cardCopies, deckSize, 7, turn);
                      probWithMulligan = baseProb;
                    }
                    
                    if (withMulligan && mulliganCount > 0 && turn >= 1) {
                      if (useMonteCarloSim) {
                        // Monte Carlo simulation for mulligan in curve
                        probWithMulligan = simulateDrawProbability({
                          deckSize,
                          copiesInDeck: cardCopies,
                          handSize: 7,
                          turnCount: turn,
                          mulliganCount,
                          simulations: Math.min(simulations, 5000) // Limit for performance
                        });
                      } else {
                        // Hypergeometric calculation for mulligan
                        const cardsKept = 7 - mulliganCount;
                        const cardsDrawn = mulliganCount;
                        const probInKept = calculateDrawProbability(cardCopies, deckSize, cardsKept, 1);
                        const probNotInKept = 100 - probInKept;
                        const remainingDeckSize = deckSize - cardsKept;
                        const probInMulligan = calculateDrawProbability(cardCopies, remainingDeckSize, cardsDrawn, 1);
                        const probAfterMulligan = probInKept + (probNotInKept/100 * probInMulligan);
                        
                        const remainingTurns = turn - 1;
                        if (remainingTurns > 0) {
                          const noCardAfterMulligan = (100 - probAfterMulligan) / 100;
                          const remainingDeckForDraw = deckSize - (7 + mulliganCount); // Fix: account for all cards seen
                          const remainingDrawProb = calculateDrawProbability(cardCopies, remainingDeckForDraw, remainingTurns, 1);
                          probWithMulligan = probAfterMulligan + (noCardAfterMulligan * remainingDrawProb);
                        } else {
                          probWithMulligan = probAfterMulligan;
                        }
                      }
                    }
                    
                    curveData.push({
                      turn: `T${turn}`,
                      baseProb: parseFloat(baseProb.toFixed(1)),
                      withMulligan: parseFloat(probWithMulligan.toFixed(1))
                    });
                  }
                  return curveData;
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="turn" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '6px' }}
                    labelStyle={{ color: '#E5E7EB' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="baseProb" 
                    stroke="#60A5FA" 
                    strokeWidth={2}
                    name="Base Probability"
                    dot={{ fill: '#60A5FA', strokeWidth: 2, r: 3 }}
                  />
                  {withMulligan && (
                    <Line 
                      type="monotone" 
                      dataKey="withMulligan" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      name={`With Mulligan (${mulliganCount} cards)`}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Shows cumulative probability of drawing "{selectedCard}" by each turn
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Turn-by-Turn Draw Simulator Component  
function DrawSimulator({ deck }) {
  const [maxTurns, setMaxTurns] = useState(5);
  const [numSimulations, setNumSimulations] = useState(1);
  const [simulationResults, setSimulationResults] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Build deck array for shuffling
  const deckCards = useMemo(() => {
    const cards = [];
    deck.forEach(entry => {
      for (let i = 0; i < entry.count; i++) {
        cards.push({
          ...entry.card,
          cost: Number(entry.card.cost || 0),
          inkable: Boolean(entry.card.inkable ?? entry.card._raw?.inkwell ?? entry.card._raw?.inkable ?? false)
        });
      }
    });
    return cards;
  }, [deck]);

  // Simulate a single game
  const simulateGame = () => {
    const shuffledDeck = [...deckCards].sort(() => Math.random() - 0.5);
    const turns = [];
    
    // Starting hand (7 cards)
    let hand = shuffledDeck.splice(0, 7);
    let deckRemaining = shuffledDeck;
    let inkwell = 0;
    
    for (let turn = 1; turn <= maxTurns; turn++) {
      // Draw a card (except turn 1)
      if (turn > 1 && deckRemaining.length > 0) {
        hand.push(deckRemaining.shift());
      }
      
      // Increment inkwell
      inkwell = turn;
      
      // Analyze hand for this turn
      const playableCards = hand.filter(card => card.cost <= inkwell);
      const uninkableCards = hand.filter(card => !card.inkable);
      const curveHits = hand.filter(card => card.cost === turn);
      
      turns.push({
        turn,
        handSize: hand.length,
        inkwell,
        playableCards: playableCards.length,
        uninkableCards: uninkableCards.length,
        curveHits: curveHits.length,
        averageCost: hand.length > 0 ? (hand.reduce((sum, card) => sum + card.cost, 0) / hand.length).toFixed(1) : 0,
        cards: [...hand] // Copy for analysis
      });
    }
    
    return turns;
  };

  // Run simulation
  const runSimulation = () => {
    setIsSimulating(true);
    
    // Use setTimeout to prevent UI blocking
    setTimeout(() => {
      const results = [];
      for (let i = 0; i < numSimulations; i++) {
        results.push(simulateGame());
      }
      setSimulationResults(results);
      setIsSimulating(false);
    }, 10);
  };

  // Calculate averages across simulations
  const averageResults = useMemo(() => {
    if (simulationResults.length === 0) return [];
    
    const turnAverages = [];
    for (let turn = 1; turn <= maxTurns; turn++) {
      const turnData = simulationResults.map(sim => sim[turn - 1]);
      
      turnAverages.push({
        turn,
        avgHandSize: (turnData.reduce((sum, t) => sum + t.handSize, 0) / turnData.length).toFixed(1),
        avgPlayable: (turnData.reduce((sum, t) => sum + t.playableCards, 0) / turnData.length).toFixed(1),
        avgUninkable: (turnData.reduce((sum, t) => sum + t.uninkableCards, 0) / turnData.length).toFixed(1),
        avgCurveHits: (turnData.reduce((sum, t) => sum + t.curveHits, 0) / turnData.length).toFixed(1),
        avgCost: (turnData.reduce((sum, t) => sum + parseFloat(t.averageCost), 0) / turnData.length).toFixed(1)
      });
    }
    
    return turnAverages;
  }, [simulationResults, maxTurns]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-300 mb-3">
        Simulate drawing cards turn by turn to analyze consistency and curve performance.
      </div>
      
      {/* Controls */}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs uppercase text-gray-400 mb-1">
            Simulate turns (1-{maxTurns})
          </label>
          <input 
            type="range" 
            min="3" 
            max="10" 
            value={maxTurns}
            onChange={(e) => setMaxTurns(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        <div>
          <label className="block text-xs uppercase text-gray-400 mb-1">
            Number of simulations
          </label>
          <select 
            value={numSimulations}
            onChange={(e) => setNumSimulations(parseInt(e.target.value))}
            className="w-full bg-gray-800 rounded px-2 py-1 text-sm border border-white/10"
          >
            <option value={1}>1 (Preview)</option>
            <option value={10}>10 (Quick)</option>
            <option value={100}>100 (Accurate)</option>
            <option value={1000}>1000 (Precise)</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            onClick={runSimulation}
            disabled={isSimulating || deckCards.length === 0}
            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium"
          >
            {isSimulating ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* Results */}
      {simulationResults.length > 0 && (
        <div className="space-y-4">
          {numSimulations === 1 ? (
            // Single simulation - show detailed turn-by-turn
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-emerald-300">Detailed Simulation Result</h4>
              {/* 6-column turn table doesn't reflow to a single column sensibly
                  (each column is a different stat for the same turn), so it
                  scrolls horizontally in its own box on narrow viewports
                  instead of squeezing or overflowing the page. */}
              <div className="overflow-x-auto">
                <div className="space-y-2 min-w-[480px]">
                  {simulationResults[0].map(turn => (
                    <div key={turn.turn} className="grid grid-cols-6 gap-2 text-sm border-b border-gray-600 pb-2">
                      <div className="text-center">
                        <div className="font-medium">Turn {turn.turn}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Hand</div>
                        <div>{turn.handSize}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Playable</div>
                        <div className="text-emerald-400">{turn.playableCards}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Uninkable</div>
                        <div className="text-amber-400">{turn.uninkableCards}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Curve Hits</div>
                        <div className="text-blue-400">{turn.curveHits}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Avg Cost</div>
                        <div>{turn.averageCost}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Multiple simulations - show averages
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-emerald-300">
                Average Results ({numSimulations} simulations)
              </h4>
              {/* Same rationale as the detailed table above: scrolls in its
                  own box on narrow viewports rather than breaking page layout. */}
              <div className="overflow-x-auto">
                <div className="space-y-2 min-w-[480px]">
                  <div className="grid grid-cols-6 gap-2 text-xs text-gray-400 border-b border-gray-600 pb-1">
                    <div className="text-center">Turn</div>
                    <div className="text-center">Hand Size</div>
                    <div className="text-center">Playable</div>
                    <div className="text-center">Uninkable</div>
                    <div className="text-center">Curve Hits</div>
                    <div className="text-center">Avg Cost</div>
                  </div>
                  {averageResults.map(turn => (
                    <div key={turn.turn} className="grid grid-cols-6 gap-2 text-sm">
                      <div className="text-center font-medium">{turn.turn}</div>
                      <div className="text-center">{turn.avgHandSize}</div>
                      <div className="text-center text-emerald-400">{turn.avgPlayable}</div>
                      <div className="text-center text-amber-400">{turn.avgUninkable}</div>
                      <div className="text-center text-blue-400">{turn.avgCurveHits}</div>
                      <div className="text-center">{turn.avgCost}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-400">
            • <strong>Playable:</strong> Cards you can afford with current ink<br/>
            • <strong>Uninkable:</strong> Cards that can't be inked (actions/songs)<br/>
            • <strong>Curve Hits:</strong> Cards that cost exactly the current turn number
          </div>
        </div>
      )}
    </div>
  );
}


// Hoverable stat line component for consistency stats
function HoverableStatLine({ label, value, cards }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  const handleMouseEnter = (e) => {
    setShowTooltip(true);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseLeave = () => {
    setShowTooltip(false);
  };
  
  // Group cards by name and count occurrences
  const groupedCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];
    
    const cardCounts = {};
    cards.forEach(card => {
      cardCounts[card] = (cardCounts[card] || 0) + 1;
    });
    
    return Object.entries(cardCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [cards]);
  
  return (
    <>
      <div 
        className="cursor-pointer hover:bg-gray-800 rounded px-2 py-1 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <strong>{label}:</strong> {value}
      </div>
      
      {showTooltip && groupedCards.length > 0 && (
        <div 
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            maxWidth: '300px'
          }}
        >
          <p className="text-white font-semibold mb-2">{label}: {typeof value === 'string' && value.includes('%') ? cards.length : value} cards</p>
          <div>
            <p className="text-gray-300 text-sm mb-1">Cards:</p>
            {groupedCards.map(({ name, count }, index) => (
              <p key={index} className="text-gray-400 text-xs">
                {count > 1 ? `${count} - ${name}` : name}
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Hoverable stat box component for competitive dashboard consistency stats
function HoverableStatBox({ value, label, color, cards }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  const handleMouseEnter = (e) => {
    setShowTooltip(true);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseLeave = () => {
    setShowTooltip(false);
  };
  
  // Group cards by name and count occurrences
  const groupedCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];
    
    const cardCounts = {};
    cards.forEach(card => {
      cardCounts[card] = (cardCounts[card] || 0) + 1;
    });
    
    return Object.entries(cardCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [cards]);
  
  return (
    <>
      <div 
        className="cursor-pointer hover:bg-gray-600 rounded p-2 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
      </div>
      
      {showTooltip && groupedCards.length > 0 && (
        <div 
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            maxWidth: '300px'
          }}
        >
          <p className="text-white font-semibold mb-2">{label}: {typeof value === 'string' && value.includes('%') ? cards.length : value} cards</p>
          <div>
            <p className="text-gray-300 text-sm mb-1">Cards:</p>
            {groupedCards.map(({ name, count }, index) => (
              <p key={index} className="text-gray-400 text-xs">
                {count > 1 ? `${count} - ${name}` : name}
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export {
  EnhancedCurveChart,
  DrawProbabilityTool,
  DrawSimulator,
  HoverableStatLine,
  HoverableStatBox,
};
