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

// Design-token hex values for Recharts. Recharts writes fill/stroke as SVG
// presentation attributes where a plain var() does NOT resolve, so we mirror
// the ink + surface tokens from src/tokens.css here as literal hex/rgba.
const INK_HEX = {
  amber: "#f4b223",
  amethyst: "#9b59d0",
  emerald: "#2ecc71",
  ruby: "#e74c5e",
  sapphire: "#3aa0e0",
  steel: "#9aa7b8",
};
const CHART = {
  text: "#e9e7e2",   // --text
  muted: "#9a978f",  // --muted
  faint: "#6b6963",  // --faint
  panel2: "#1d1f24", // --panel-2
  line: "rgba(255,255,255,.13)", // --line-2
};

// Enhanced Curve Chart with Meta Comparison
function EnhancedCurveChart({ data }) {
  const [showMeta, setShowMeta] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState('midrange');
  
  const archetypes = ['aggro', 'midrange', 'control', 'ramp'];
  const archetypeColors = {
    aggro: INK_HEX.ruby,
    midrange: INK_HEX.sapphire,
    control: INK_HEX.amethyst,
    ramp: INK_HEX.emerald
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
            className="rounded"
            style={{ accentColor: 'var(--sapphire)' }}
          />
          <label htmlFor="show-meta" style={{ color: 'var(--muted)' }}>Show meta curve</label>
        </div>

        {showMeta && (
          <select
            value={selectedArchetype}
            onChange={(e) => setSelectedArchetype(e.target.value)}
            className="rounded px-2 py-1 text-xs border"
            style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
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
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.line} />
          <XAxis dataKey="cost" stroke={CHART.faint} tick={{ fill: CHART.faint, fontSize: 12 }} />
          <YAxis allowDecimals={false} stroke={CHART.faint} tick={{ fill: CHART.faint, fontSize: 12 }} />
          <Tooltip content={({ active, payload, label }) => {
            if (active && payload && payload.length > 0) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg p-3 shadow-lg border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)' }}>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>Cost {label}</p>
                  <p style={{ color: 'var(--emerald)' }}>Inkable: {data.inkable}</p>
                  <p style={{ color: 'var(--amber)' }}>Uninkable: {data.uninkable}</p>
                  <p style={{ color: 'var(--muted)' }}>Total: {data.total}</p>
                  {showMeta && (
                    <p className="mt-1" style={{ color: 'var(--sapphire)' }}>
                      Meta ({selectedArchetype}): {Math.round(data[`meta_${selectedArchetype}`] || 0)}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }} />
          <Legend wrapperStyle={{ color: CHART.muted, fontSize: 12 }} />
          <Bar dataKey="inkable" stackId="deck" fill={INK_HEX.emerald} name="Inkable" />
          <Bar dataKey="uninkable" stackId="deck" fill={INK_HEX.amber} name="Uninkable" />
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
        <div className="text-xs mt-2" style={{ color: 'var(--faint)' }}>
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
      <div className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
        Calculate the probability of drawing a specific card by a target turn.
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card Selection */}
        <div>
          <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--faint)' }}>Select Card</label>
          <select
            className="w-full rounded px-2 py-1 text-sm border"
            style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
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
          <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--faint)' }}>Target Turn</label>
          <select
            className="w-full rounded px-2 py-1 text-sm border"
            style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
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
      <div className="rounded-lg p-3 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            id="mulligan"
            checked={withMulligan}
            onChange={(e) => setWithMulligan(e.target.checked)}
            className="rounded"
            style={{ accentColor: 'var(--sapphire)' }}
          />
          <label htmlFor="mulligan" className="text-sm" style={{ color: 'var(--muted)' }}>
            Include mulligan opportunity
          </label>
        </div>

        {withMulligan && (
          <div>
            <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--faint)' }}>
              Cards to Mulligan
            </label>
            <select
              className="w-full rounded px-2 py-1 text-sm border"
              style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
              value={mulliganCount}
              onChange={(e) => setMulliganCount(parseInt(e.target.value))}
            >
              {Array.from({length: 7}, (_, i) => i + 1).map(count => (
                <option key={count} value={count}>
                  {count} card{count !== 1 ? 's' : ''} ({7 - count} kept)
                </option>
              ))}
            </select>
            <div className="text-xs mt-1" style={{ color: 'var(--faint)' }}>
              Assumes optimal mulligan decision for target card
            </div>
          </div>
        )}
      </div>

      {/* Monte Carlo Simulation Options */}
      <div className="rounded-lg p-3 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            id="monte-carlo"
            checked={useMonteCarloSim}
            onChange={(e) => setUseMonteCarloSim(e.target.checked)}
            className="rounded"
            style={{ accentColor: 'var(--sapphire)' }}
          />
          <label htmlFor="monte-carlo" className="text-sm" style={{ color: 'var(--muted)' }}>
            🎲 Use Monte Carlo simulation
          </label>
        </div>

        {useMonteCarloSim && (
          <div>
            <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--faint)' }}>
              Number of Simulations
            </label>
            <select
              className="w-full rounded px-2 py-1 text-sm border"
              style={{ background: 'var(--panel)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
              value={simulations}
              onChange={(e) => setSimulations(parseInt(e.target.value))}
            >
              <option value={1000}>1,000 (Fast)</option>
              <option value={10000}>10,000 (Balanced)</option>
              <option value={50000}>50,000 (Accurate)</option>
              <option value={100000}>100,000 (High Precision)</option>
            </select>
            <div className="text-xs mt-1" style={{ color: 'var(--faint)' }}>
              Higher simulation count = more accurate results but slower calculation
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {selectedCard && (
        <div className="rounded-lg p-4 mt-4 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
          <h4 className="font-display mb-3" style={{ fontWeight: 560, color: 'var(--emerald)' }}>
            Probability Results for "{selectedCard}" {useMonteCarloSim ? '🎲' : '🧮'}
          </h4>
          <div className="text-xs mb-3" style={{ color: 'var(--faint)' }}>
            {useMonteCarloSim ?
              `Monte Carlo simulation with ${simulations.toLocaleString()} runs` :
              'Hypergeometric probability calculation'
            }
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                {openingHandProb.toFixed(1)}%
              </div>
              <div style={{ color: 'var(--faint)' }}>Opening Hand</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                {targetTurnProb.toFixed(1)}%
              </div>
              <div style={{ color: 'var(--faint)' }}>By Turn {targetTurn}</div>
            </div>
            {withMulligan && (
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--emerald)' }}>
                  {finalProb.toFixed(1)}%
                </div>
                <div style={{ color: 'var(--faint)' }}>
                  With Mulligan ({mulliganCount} cards)
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-xs" style={{ color: 'var(--faint)' }}>
            <div>• Deck size: {deckSize} cards</div>
            <div>• Copies in deck: {cardCopies}</div>
            <div>• Cards drawn by turn {targetTurn}: {Math.min(7 + (targetTurn - 1), deckSize)}</div>
            {withMulligan && (
              <div>• Mulligan strategy: Keep {7 - mulliganCount}, redraw {mulliganCount}</div>
            )}
          </div>

          {/* Turn-by-Turn Probability Curve */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
            <h5 className="text-sm font-display mb-3" style={{ fontWeight: 560, color: 'var(--emerald)' }}>📈 Probability Curve (Turn 1-10)</h5>
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
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.line} />
                  <XAxis dataKey="turn" stroke={CHART.faint} fontSize={12} tick={{ fill: CHART.faint }} />
                  <YAxis stroke={CHART.faint} fontSize={12} tick={{ fill: CHART.faint }} domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft', fill: CHART.faint }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART.panel2, border: `1px solid ${CHART.line}`, borderRadius: '6px' }}
                    labelStyle={{ color: CHART.text }}
                  />
                  <Line
                    type="monotone"
                    dataKey="baseProb"
                    stroke={INK_HEX.sapphire}
                    strokeWidth={2}
                    name="Base Probability"
                    dot={{ fill: INK_HEX.sapphire, strokeWidth: 2, r: 3 }}
                  />
                  {withMulligan && (
                    <Line
                      type="monotone"
                      dataKey="withMulligan"
                      stroke={INK_HEX.emerald}
                      strokeWidth={2}
                      name={`With Mulligan (${mulliganCount} cards)`}
                      dot={{ fill: INK_HEX.emerald, strokeWidth: 2, r: 3 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs mt-2" style={{ color: 'var(--faint)' }}>
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
      <div className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
        Simulate drawing cards turn by turn to analyze consistency and curve performance.
      </div>

      {/* Controls */}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--faint)' }}>
            Simulate turns (1-{maxTurns})
          </label>
          <input
            type="range"
            min="3"
            max="10"
            value={maxTurns}
            onChange={(e) => setMaxTurns(parseInt(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ background: 'var(--panel-2)', accentColor: 'var(--sapphire)' }}
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--faint)' }}>
            Number of simulations
          </label>
          <select
            value={numSimulations}
            onChange={(e) => setNumSimulations(parseInt(e.target.value))}
            className="w-full rounded px-2 py-1 text-sm border"
            style={{ background: 'var(--panel-2)', borderColor: 'var(--line-2)', color: 'var(--text)' }}
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
            className="w-full px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition hover:brightness-110"
            style={{ background: 'var(--sapphire)', color: '#0b1620' }}
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
            <div className="rounded-lg p-4 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
              <h4 className="font-display mb-3" style={{ fontWeight: 560, color: 'var(--emerald)' }}>Detailed Simulation Result</h4>
              {/* 6-column turn table doesn't reflow to a single column sensibly
                  (each column is a different stat for the same turn), so it
                  scrolls horizontally in its own box on narrow viewports
                  instead of squeezing or overflowing the page. */}
              <div className="overflow-x-auto">
                <div className="space-y-2 min-w-[480px]">
                  {simulationResults[0].map(turn => (
                    <div key={turn.turn} className="grid grid-cols-6 gap-2 text-sm border-b pb-2" style={{ borderColor: 'var(--line)', color: 'var(--text)' }}>
                      <div className="text-center">
                        <div className="font-medium">Turn {turn.turn}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ color: 'var(--faint)' }}>Hand</div>
                        <div className="tabular-nums">{turn.handSize}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ color: 'var(--faint)' }}>Playable</div>
                        <div className="tabular-nums" style={{ color: 'var(--emerald)' }}>{turn.playableCards}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ color: 'var(--faint)' }}>Uninkable</div>
                        <div className="tabular-nums" style={{ color: 'var(--amber)' }}>{turn.uninkableCards}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ color: 'var(--faint)' }}>Curve Hits</div>
                        <div className="tabular-nums" style={{ color: 'var(--sapphire)' }}>{turn.curveHits}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ color: 'var(--faint)' }}>Avg Cost</div>
                        <div className="tabular-nums">{turn.averageCost}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Multiple simulations - show averages
            <div className="rounded-lg p-4 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
              <h4 className="font-display mb-3" style={{ fontWeight: 560, color: 'var(--emerald)' }}>
                Average Results ({numSimulations} simulations)
              </h4>
              {/* Same rationale as the detailed table above: scrolls in its
                  own box on narrow viewports rather than breaking page layout. */}
              <div className="overflow-x-auto">
                <div className="space-y-2 min-w-[480px]">
                  <div className="grid grid-cols-6 gap-2 text-[11px] uppercase tracking-[0.1em] font-semibold border-b pb-1" style={{ color: 'var(--faint)', borderColor: 'var(--line)' }}>
                    <div className="text-center">Turn</div>
                    <div className="text-center">Hand Size</div>
                    <div className="text-center">Playable</div>
                    <div className="text-center">Uninkable</div>
                    <div className="text-center">Curve Hits</div>
                    <div className="text-center">Avg Cost</div>
                  </div>
                  {averageResults.map(turn => (
                    <div key={turn.turn} className="grid grid-cols-6 gap-2 text-sm" style={{ color: 'var(--text)' }}>
                      <div className="text-center font-medium tabular-nums">{turn.turn}</div>
                      <div className="text-center tabular-nums">{turn.avgHandSize}</div>
                      <div className="text-center tabular-nums" style={{ color: 'var(--emerald)' }}>{turn.avgPlayable}</div>
                      <div className="text-center tabular-nums" style={{ color: 'var(--amber)' }}>{turn.avgUninkable}</div>
                      <div className="text-center tabular-nums" style={{ color: 'var(--sapphire)' }}>{turn.avgCurveHits}</div>
                      <div className="text-center tabular-nums">{turn.avgCost}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="text-xs" style={{ color: 'var(--faint)' }}>
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
        className="cursor-pointer hover:bg-[var(--panel-2)] rounded px-2 py-1 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <strong>{label}:</strong> {value}
      </div>

      {showTooltip && groupedCards.length > 0 && (
        <div
          className="fixed z-50 border rounded-lg p-3 shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            maxWidth: '300px',
            background: 'var(--panel-2)',
            borderColor: 'var(--line-2)'
          }}
        >
          <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>{label}: {typeof value === 'string' && value.includes('%') ? cards.length : value} cards</p>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Cards:</p>
            {groupedCards.map(({ name, count }, index) => (
              <p key={index} className="text-xs" style={{ color: 'var(--faint)' }}>
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
        className="cursor-pointer hover:bg-[var(--panel-2)] rounded p-2 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
        <div className="text-sm" style={{ color: 'var(--faint)' }}>{label}</div>
      </div>

      {showTooltip && groupedCards.length > 0 && (
        <div
          className="fixed z-50 border rounded-lg p-3 shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            maxWidth: '300px',
            background: 'var(--panel-2)',
            borderColor: 'var(--line-2)'
          }}
        >
          <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>{label}: {typeof value === 'string' && value.includes('%') ? cards.length : value} cards</p>
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Cards:</p>
            {groupedCards.map(({ name, count }, index) => (
              <p key={index} className="text-xs" style={{ color: 'var(--faint)' }}>
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
