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
    <div className="space-y-1.5 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <p key={i} className="font-display mt-4 first:mt-0" style={{ fontWeight: 560, color: 'var(--text)' }}>{line.slice(3)}</p>;
        if (line.startsWith('### ')) return <p key={i} className="font-display mt-3" style={{ fontWeight: 560, fontSize: '13px', color: 'var(--text)' }}>{line.slice(4)}</p>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="pl-3" style={{ borderLeft: '2px solid var(--line-2)', color: 'var(--muted)' }}>{line.slice(2)}</p>;
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
        <h1 className="font-display text-lg mb-0.5" style={{ fontWeight: 560, color: 'var(--text)' }}>Ask AI</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Ask about cards, decks, meta, or team stats — anywhere in the app. It can look up card text, your saved
          decks, and (if you pick a hub below) that team's practice results, reviews, primers, and reports.
        </p>
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
            Team Hub context (optional)
            <select
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border text-sm normal-case tracking-normal focus:outline-none"
              style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
            >
              <option value="">No hub — cards &amp; my decks only</option>
              {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>

          <label className="flex-1 text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--faint)' }}>
            Attach a deck (optional)
            <select
              value={deckMode}
              onChange={(e) => setDeckMode(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border text-sm normal-case tracking-normal focus:outline-none"
              style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
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
            className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none"
            style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
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
            className="w-full p-3 rounded-md border text-sm resize-none focus:outline-none"
            style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
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
          className="w-full p-3 rounded-md border text-sm resize-none focus:outline-none disabled:opacity-50"
          style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' }}
        />
        {error && <p className="text-sm" style={{ color: 'var(--ruby)' }}>{error}</p>}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs order-2 sm:order-1" style={{ color: 'var(--faint)' }}>Press Enter to send · Shift+Enter for new line</p>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="order-1 sm:order-2 w-full sm:w-auto px-4 py-2 rounded-md text-sm font-semibold hover:brightness-110 disabled:opacity-40 transition"
            style={{ background: 'var(--sapphire)', color: '#0b1620' }}
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </form>

      {history.length === 0 && !loading && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] mb-2 font-semibold" style={{ color: 'var(--faint)' }}>Try asking</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'var(--line-2)', color: 'var(--muted)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border p-5 text-sm animate-pulse" style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--muted)' }}>
          Looking into it…
        </div>
      )}

      {history.map((item, i) => (
        <div key={i} className="space-y-3">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <p className="text-[11px] uppercase tracking-[0.1em] mb-1 font-semibold" style={{ color: 'var(--faint)' }}>Question</p>
            <p className="text-sm" style={{ color: 'var(--text)' }}>{item.question}</p>
          </div>
          <div className="rounded-xl border p-5" style={{ borderColor: 'color-mix(in srgb, var(--sapphire) 30%, var(--line))', background: 'var(--panel)' }}>
            <p className="text-[11px] uppercase tracking-[0.1em] mb-3 font-semibold" style={{ color: 'var(--sapphire)' }}>Answer</p>
            <MarkdownText text={item.answer} />
            {item.toolsUsed?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                <span className="text-xs" style={{ color: 'var(--faint)' }}>Looked up:</span>
                {item.toolsUsed.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full border" style={{ background: 'var(--panel-2)', color: 'var(--faint)', borderColor: 'var(--line-2)' }}>
                    {TOOL_LABELS[t] || t}
                  </span>
                ))}
              </div>
            )}
            {item.deckWarnings?.length > 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--amber)' }}>{item.deckWarnings.join(' · ')}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
