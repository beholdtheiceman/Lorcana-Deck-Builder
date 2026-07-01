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

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/hubs/${hub.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setHistory(prev => [{ question: text, answer: data.answer }, ...prev].slice(0, 5));
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
        <h3 className="text-lg font-semibold text-white mb-0.5">Ask the Meta</h3>
        <p className="text-sm text-gray-400">
          Ask questions about your team's data — matchup win rates, primers, and meta reports are all in context.
        </p>
      </div>

      <LlmBudgetBar hubId={hub.id} />

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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Press Enter to send · Shift+Enter for new line</p>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
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
