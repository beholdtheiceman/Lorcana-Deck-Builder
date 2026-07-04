import React, { useState, useEffect } from 'react';

const EXAMPLE_QUESTIONS = [
  "What kind of deck can be built around Kida - Crystal Scion?",
  "What are our top performing team decks?",
  "How did Larry do in his matchup with Blurple against GB Control?",
  "What does Ward do, and which of my decks run it?",
];

const TOOL_LABELS = {
  search_cards: 'Card search',
  get_card: 'Card lookup',
  list_my_hubs: 'Hub list',
  list_my_decks: 'My decks',
  get_deck: 'Deck detail',
  team_stats: 'Team stats',
  search_team_reviews: 'Reviews',
  search_primers: 'Primers',
  search_meta_reports: 'Meta reports',
  search_tournament_results: 'Tournament results',
};

function MarkdownText({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm text-gray-200 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} className="text-base font-semibold text-violet-300 mt-4 first:mt-0">{line.slice(3)}</h3>;
        if (line.startsWith('### ')) return <h4 key={i} className="text-sm font-semibold text-gray-100 mt-3">{line.slice(4)}</h4>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="pl-3 border-l-2 border-violet-500/30">{line.slice(2)}</p>;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function AskAiPage() {
  const [hubs, setHubs] = useState([]);
  const [hubId, setHubId] = useState('');
  const [myDecks, setMyDecks] = useState([]);
  const [deckMode, setDeckMode] = useState('none'); // 'none' | 'saved' | 'paste'
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [pastedDeck, setPastedDeck] = useState('');

  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/hubs').then(r => r.ok ? r.json() : []).then(data => setHubs(Array.isArray(data) ? data : [])).catch(() => {});
    fetch('/api/decks').then(r => r.ok ? r.json() : { decks: [] }).then(data => setMyDecks(data.decks || [])).catch(() => {});
  }, []);

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    try {
      const body = { question: text };
      if (hubId) body.hubId = hubId;
      if (deckMode === 'saved' && selectedDeckId) body.deck = { deckId: selectedDeckId };
      if (deckMode === 'paste' && pastedDeck.trim()) body.deck = { text: pastedDeck.trim() };

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setHistory(prev => [{ question: text, answer: data.answer, toolsUsed: data.toolsUsed || [], deckWarnings: data.deckWarnings }, ...prev].slice(0, 8));
      setQuestion('');
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white mb-0.5">Ask AI</h1>
        <p className="text-sm text-gray-400">
          Ask about cards, decks, meta, or team stats — anywhere in the app. It can look up card text, your saved
          decks, and (if you pick a hub below) that team's practice results, reviews, primers, and reports.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 text-xs text-gray-400">
            Team Hub context (optional)
            <select
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-gray-800 text-sm text-white focus:border-violet-400/60 focus:outline-none"
            >
              <option value="">No hub — cards &amp; my decks only</option>
              {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>

          <label className="flex-1 text-xs text-gray-400">
            Attach a deck (optional)
            <select
              value={deckMode}
              onChange={(e) => setDeckMode(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-gray-800 text-sm text-white focus:border-violet-400/60 focus:outline-none"
            >
              <option value="none">None</option>
              <option value="saved">One of my saved decks</option>
              <option value="paste">Paste a decklist</option>
            </select>
          </label>
        </div>

        {deckMode === 'saved' && (
          <select
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-gray-800 text-sm text-white focus:border-violet-400/60 focus:outline-none"
          >
            <option value="">Choose a deck…</option>
            {myDecks.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        )}

        {deckMode === 'paste' && (
          <textarea
            value={pastedDeck}
            onChange={(e) => setPastedDeck(e.target.value)}
            placeholder={'4 Elsa - Snow Queen\n2 Be Prepared\n...'}
            rows={4}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm resize-none focus:border-violet-500 focus:outline-none"
          />
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
          placeholder="Ask anything about cards, decks, meta, or team stats…"
          rows={3}
          disabled={loading}
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm resize-none focus:border-violet-500 focus:outline-none disabled:opacity-50"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-gray-500 order-2 sm:order-1">Press Enter to send · Shift+Enter for new line</p>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="order-1 sm:order-2 w-full sm:w-auto px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </form>

      {history.length === 0 && !loading && (
        <div>
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/[0.06] text-violet-300 hover:bg-violet-500/[0.12] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-gray-400 animate-pulse">
          Looking into it…
        </div>
      )}

      {history.map((item, i) => (
        <div key={i} className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">Question</p>
            <p className="text-sm text-gray-200">{item.question}</p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
            <p className="text-xs text-violet-400 mb-3 uppercase tracking-wide font-medium">Answer</p>
            <MarkdownText text={item.answer} />
            {item.toolsUsed?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-white/10">
                <span className="text-xs text-gray-500">Looked up:</span>
                {item.toolsUsed.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                    {TOOL_LABELS[t] || t}
                  </span>
                ))}
              </div>
            )}
            {item.deckWarnings?.length > 0 && (
              <p className="text-xs text-amber-400 mt-2">{item.deckWarnings.join(' · ')}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
