import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const HubDetailModal = ({ hub, onClose, onDeckClick }) => {
  const { user } = useAuth();
  const [hubDecks, setHubDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hub) {
      fetchHubDecks();
    }
  }, [hub]);

  const fetchHubDecks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hubs/${hub.id}/decks`);

      if (!response.ok) {
        throw new Error('Failed to fetch hub decks');
      }

      const decks = await response.json();
      setHubDecks(decks);
    } catch (error) {
      console.error('Error fetching hub decks:', error);
      setError('Failed to load hub decks');
    } finally {
      setLoading(false);
    }
  };

  if (!hub) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">{hub.name}</h2>
            <p className="text-gray-400">
              {hub.members.length + 1} member{(hub.members.length + 1) !== 1 ? 's' : ''} • 
              Invite Code: <span className="font-mono bg-gray-800 px-2 py-1 rounded">{hub.inviteCode}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-white">Loading decks...</div>
            </div>
          ) : error ? (
            <div className="text-red-400 text-center">{error}</div>
          ) : (
            <div>
              {/* Hub Info */}
              <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Hub Members</h3>
                <div className="flex flex-wrap gap-2">
                  {/* Owner */}
                  <span className="px-3 py-1 rounded-full text-sm bg-purple-600 text-white">
                    {hub.owner.email} (Owner)
                  </span>
                  {/* Members */}
                  {hub.members.map((member) => (
                    <span
                      key={member.user.id}
                      className="px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-300"
                    >
                      {member.user.email}
                    </span>
                  ))}
                </div>
              </div>

              {/* Decks Grid */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Shared Decks ({hubDecks.length})
                </h3>
                {hubDecks.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No decks shared in this hub yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hubDecks.map((deck) => (
                      <div
                        key={deck.id}
                        onClick={() => onDeckClick(deck)}
                        className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700 hover:border-purple-500"
                      >
                        <div className="aspect-[3/4] bg-gray-700 rounded mb-3 flex items-center justify-center">
                          <div className="text-gray-400 text-center">
                            <div className="text-2xl mb-2">🎴</div>
                            <div className="text-sm">{deck.title}</div>
                          </div>
                        </div>
                        <h4 className="text-white font-semibold mb-1">{deck.title}</h4>
                        <p className="text-gray-400 text-sm">
                          by {deck.user.email}
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                          {deck.cardCount || 0} cards
                        </p>
                        {deck.sampleCards && deck.sampleCards.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {deck.sampleCards.map((card, index) => (
                              <div key={index} className="text-xs text-gray-400">
                                {card.cost} {card.ink} • {card.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HubDetailModal;
