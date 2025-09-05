import React, { useState, useEffect } from 'react';
import DeckViewModal from './DeckViewModal';

const HubDetailModal = ({ hub, onClose, onDeckClick, user }) => {
  const [hubDecks, setHubDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [deletingDeckId, setDeletingDeckId] = useState(null);

  useEffect(() => {
    const fetchHubDecks = async () => {
      try {
        console.log('🔍 HubDetailModal: Starting to fetch decks for hub:', hub.id);
        setLoading(true);
        
        const response = await fetch(`/api/hubs/${hub.id}/decks`);
        console.log('🔍 HubDetailModal: API response status:', response.status);
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const decks = await response.json();
        console.log('🔍 HubDetailModal: Received decks:', decks);
        console.log('🔍 HubDetailModal: First deck data:', decks[0]);
        
        // Log ownership breakdown for debugging
        const decksByUser = {};
        decks.forEach(deck => {
          const userEmail = deck.user?.email || 'Unknown';
          if (!decksByUser[userEmail]) {
            decksByUser[userEmail] = [];
          }
          decksByUser[userEmail].push(deck.title);
        });
        
        console.log('🔍 HubDetailModal: Decks by user:');
        Object.keys(decksByUser).forEach(userEmail => {
          console.log(`  ${userEmail}: ${decksByUser[userEmail].length} decks - ${decksByUser[userEmail].join(', ')}`);
        });
        
        setHubDecks(decks);
      } catch (error) {
        console.error('Error fetching hub decks:', error);
        setError('Failed to load decks.');
      } finally {
        setLoading(false);
      }
    };
  
    if (hub?.id) {
      fetchHubDecks();
    }
  }, [hub]);

  const handleDeckClick = (deck) => {
    setSelectedDeck(deck);
  };

  const handleBackToHub = () => {
    setSelectedDeck(null);
  };

  const handleDeleteDeck = async (deckId, deckTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${deckTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingDeckId(deckId);
      
      const response = await fetch(`/api/hubs/${hub.id}/decks`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deckId })
      });

      if (response.ok) {
        // Remove the deck from the local state
        setHubDecks(prevDecks => prevDecks.filter(deck => deck.id !== deckId));
        console.log('Deck deleted successfully');
      } else {
        const errorData = await response.json();
        console.error('Failed to delete deck:', errorData.error);
        alert(`Failed to delete deck: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting deck:', error);
      alert('Failed to delete deck. Please try again.');
    } finally {
      setDeletingDeckId(null);
    }
  };

  const canDeleteDeck = (deck) => {
    if (!user) return false;
    // Users can delete their own decks, or hub owners can delete any deck
    return deck.userId === user.id || hub.ownerId === user.id;
  };

  // If a deck is selected, show the deck view
  if (selectedDeck) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-900 rounded-lg w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <DeckViewModal 
              deck={selectedDeck} 
              hub={hub} 
              onBack={handleBackToHub} 
            />
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show the hub view
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
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
        <div className="flex-1 overflow-y-auto p-4">
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
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-white">
                    Shared Decks ({hubDecks.length})
                  </h3>
                  {/* Delete All Button - only for hub owners */}
                  {user && hub.ownerId === user.id && hubDecks.length > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete ALL ${hubDecks.length} decks from this hub? This action cannot be undone.`)) {
                          // Delete all decks
                          hubDecks.forEach(deck => {
                            handleDeleteDeck(deck.id, deck.title);
                          });
                        }
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                      title="Delete all decks from this hub (Hub Owner only)"
                    >
                      Delete All Decks
                    </button>
                  )}
                </div>
                {hubDecks.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No decks shared in this hub yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hubDecks.map((deck) => (
                      <div
                        key={deck.id}
                        className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-purple-500 transition-colors relative group"
                      >
                        <div
                          onClick={() => handleDeckClick(deck)}
                          className="cursor-pointer"
                        >
                          <h4 className="text-white font-semibold mb-2 text-lg">{deck.title}</h4>
                          <p className="text-gray-400 text-sm mb-2">
                            by {deck.user.email}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {deck.cardCount || 0} cards
                          </p>
                        </div>
                        
                        {/* Delete button - only show if user can delete this deck */}
                        {canDeleteDeck(deck) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDeck(deck.id, deck.title);
                            }}
                            disabled={deletingDeckId === deck.id}
                            className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title={hub.ownerId === user.id ? "Delete deck (Hub Owner)" : "Delete your deck"}
                          >
                            {deletingDeckId === deck.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
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
