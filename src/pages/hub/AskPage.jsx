import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import LlmBudgetBar from '../../components/LlmBudgetBar';

const EXAMPLE_QUESTIONS = [
  "What's our best-performing deck right now?",
  "How does Steel Song match up against the current field?",
  "What are our biggest weak matchups?",
  "Which decks should we focus on testing this week?",
];

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

export default function AskPage() {
  const { hub } = useOutletContext();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachedDeck, setAttachedDeck] = useState(null); // { type:'saved', deckId, title, cardCount } | { type:'text', text }
  const [deckWarnings, setDeckWarnings] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('saved'); // 'saved' | 'paste'
  const [savedDecks, setSavedDecks] = useState(null); // null = not loaded
  const [pasteText, setPasteText] = useState('');

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/hubs/${hub.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          ...(attachedDeck
            ? {
                deck:
                  attachedDeck.type === 'saved'
                    ? { deckId: attachedDeck.deckId }
                    : { text: attachedDeck.text },
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setDeckWarnings(data.deckWarnings || []);
      setHistory(prev => [{ question: text, answer: data.answer }, ...prev].slice(0, 5));
      setQuestion('');
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const openPanel = async () => {
    setPanelOpen(true);
    if (savedDecks === null) {
      try {
        const res = await fetch(`/api/hubs/${hub.id}/decks`);
        const data = await res.json();
        setSavedDecks(res.ok && Array.isArray(data) ? data : []);
      } catch {
        setSavedDecks([]);
      }
    }
  };

  const attachSaved = (d) => {
    setAttachedDeck({ type: 'saved', deckId: d.id, title: d.title, cardCount: d.cardCount });
    setDeckWarnings([]);
    setPanelOpen(false);
  };

  const attachPasted = () => {
    const text = pasteText.trim();
    if (!text) return;
    setAttachedDeck({ type: 'text', text });
    setDeckWarnings([]);
    setPanelOpen(false);
  };

  const removeDeck = () => {
    setAttachedDeck(null);
    setDeckWarnings([]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-0.5">Ask the Meta</h3>
        <p className="text-sm text-gray-400">
          Ask questions about your team's data — matchup win rates, primers, and meta reports are all in context.
          Attach a deck to ask about a specific list.
        </p>
      </div>

      <LlmBudgetBar hubId={hub.id} />

      <div className="space-y-2">
        {!attachedDeck && (
          <button
            type="button"
            onClick={() => (panelOpen ? setPanelOpen(false) : openPanel())}
            className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] transition-colors"
          >
            📎 Attach a deck
          </button>
        )}

        {attachedDeck && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/[0.08] text-violet-200">
              🃏 {attachedDeck.type === 'saved'
                ? `${attachedDeck.title}${attachedDeck.cardCount ? ` · ${attachedDeck.cardCount} cards` : ''}`
                : 'Pasted list'}
              <button
                type="button"
                onClick={removeDeck}
                aria-label="Remove attached deck"
                className="text-violet-300 hover:text-white"
              >
                ✕
              </button>
            </span>
            <span className="text-xs text-gray-500">Attached to every question until removed</span>
          </div>
        )}

        {deckWarnings.length > 0 && (
          <p className="text-xs text-amber-400">
            {deckWarnings.length} deck line{deckWarnings.length > 1 ? 's' : ''} not recognized: {deckWarnings.join('; ')}
          </p>
        )}

        {panelOpen && !attachedDeck && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex gap-2">
              {[['saved', 'Saved decks'], ['paste', 'Paste a list']].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPanelTab(tab)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    panelTab === tab
                      ? 'border-violet-500/50 bg-violet-500/[0.12] text-violet-200'
                      : 'border-white/10 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {panelTab === 'saved' && (
              <div className="max-h-56 overflow-y-auto space-y-1">
                {savedDecks === null && <p className="text-xs text-gray-500">Loading decks…</p>}
                {savedDecks?.length === 0 && (
                  <p className="text-xs text-gray-500">No saved decks in this hub yet — try pasting a list instead.</p>
                )}
                {savedDecks?.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => attachSaved(d)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-sm text-gray-200">{d.title}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {d.cardCount} cards · {d.user?.email}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {panelTab === 'paste' && (
              <div className="space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'4 Be Prepared\n3 Mickey Mouse - Brave Little Tailor\n…'}
                  rows={6}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-mono resize-none focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={attachPasted}
                  disabled={!pasteText.trim()}
                  className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  Attach list
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
          placeholder="Ask anything about your team's meta…"
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
          Consulting your team's data…
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
          </div>
        </div>
      ))}
    </div>
  );
}
