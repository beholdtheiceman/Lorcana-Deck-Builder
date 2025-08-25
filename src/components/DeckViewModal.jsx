import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const DeckViewModal = ({ deck, hub, onBack }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [postingComment, setPostingComment] = useState(false);
  const [error, setError] = useState('');

  const isOwner = user?.id === deck.userId;

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoadingComments(true);
        const response = await fetch(`/api/decks/${deck.id}/comments`);
    
        if (response.ok) {
          const data = await response.json();
          setComments(data);
        } else {
          throw new Error('Failed to fetch comments');
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
        setError('Failed to load comments.');
      } finally {
        setLoadingComments(false);
      }
    };

    if (deck?.id) {
      fetchComments();
    }
  }, [deck?.id]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !user?.id) return;

    try {
      setPostingComment(true);
      const response = await fetch(`/api/decks/${deck.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment })
      });

      if (response.ok) {
        const postedComment = await response.json();
        setComments([...comments, postedComment]);
        setNewComment('');
      } else {
        throw new Error('Failed to post comment');
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      setError('Failed to post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  if (!deck) return null;

  return (
    <div className="bg-gray-900 h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">{deck.title}</h1>
            <p className="text-gray-400">
              by {deck.user.email} • {hub?.name} Hub
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            ← Back to Hub
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Deck Display */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Deck View</h2>
              
              {/* Deck Info */}
              <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                <div className="text-gray-300 text-sm space-y-2">
                  <p><span className="font-semibold">Cards:</span> {(() => {
                    const entries = Object.values(deck.data?.entries || {}).filter((e) => e.count > 0);
                    return entries.reduce((total, e) => total + (e.count || 0), 0);
                  })()}</p>
                  <p><span className="font-semibold">Created:</span> {new Date(deck.createdAt).toLocaleDateString()}</p>
                  <p><span className="font-semibold">Last Updated:</span> {new Date(deck.updatedAt).toLocaleDateString()}</p>
                  {isOwner && (
                    <p className="text-purple-400 font-semibold">You own this deck</p>
                  )}
                </div>
              </div>

              {/* Deck Cards - Actual deck display */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(() => {
                  const entries = Object.values(deck.data?.entries || {}).filter((e) => e.count > 0);
                  console.log('🔍 DeckViewModal: Deck data:', deck.data);
                  console.log('🔍 DeckViewModal: Entries:', entries);
                  console.log('🔍 DeckViewModal: Total cards:', entries.reduce((total, e) => total + (e.count || 0), 0));
                  
                  const groupedByCost = {};
                  
                  // Group cards by cost
                  entries.forEach((e) => {
                    const cost = e.card?.cost || 0;
                    if (!groupedByCost[cost]) groupedByCost[cost] = [];
                    groupedByCost[cost].push(e);
                  });
                  
                  console.log('🔍 DeckViewModal: Grouped by cost:', groupedByCost);
                  
                  return Object.keys(groupedByCost)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((cost) => (
                      <div key={cost} className="bg-gray-700 rounded-lg border border-gray-600">
                        <div className="px-3 py-2 font-semibold border-b border-gray-600 text-white">
                          Cost {cost} ({groupedByCost[cost].reduce((sum, e) => sum + (e.count || 0), 0)} cards)
                        </div>
                        <div className="divide-y divide-gray-600">
                          {groupedByCost[cost].map((e) => (
                            <div key={`${e.card?.name}-${e.card?.set}-${e.card?.number}`} className="flex items-center gap-3 p-3">
                              {/* Card Image */}
                              <div className="relative">
                                <img 
                                  src={e.card?.image_url || e.card?._imageFromAPI || '/card-back.jpg'} 
                                  alt={e.card?.name} 
                                  className="w-16 h-22 object-cover rounded-lg border border-gray-600" 
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                {/* Fallback display when no image */}
                                <div 
                                  className="w-16 h-22 bg-gray-800 rounded-lg border border-gray-600 flex items-center justify-center hidden"
                                >
                                  <div className="text-center text-gray-400">
                                    <div className="text-xs mb-1">No image</div>
                                    <div className="text-xs font-medium">{e.card?.name}</div>
                                  </div>
                                </div>
                                
                                {/* Count Bubble */}
                                <div className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-emerald-700 shadow-lg">
                                  {e.count}
                                </div>
                              </div>
                              
                              {/* Card Info */}
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-white">{e.card?.name}</div>
                                <div className="text-xs text-gray-400">
                                  {e.card?.set} • #{e.card?.number} • Cost {e.card?.cost} • {e.card?.type} • {e.card?.rarity}
                                </div>
                                {(e.card?.franchise || e.card?.lore > 0 || e.card?.willpower > 0 || e.card?.strength > 0) && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {e.card?.franchise && <span className="mr-2">{e.card.franchise}</span>}
                                    {e.card?.lore > 0 && <span className="mr-2">Lore: {e.card.lore}</span>}
                                    {e.card?.willpower > 0 && <span className="mr-2">Will: {e.card.willpower}</span>}
                                    {e.card?.strength > 0 && <span className="mr-2">Str: {e.card.strength}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Comments</h3>
              {error && <p className="text-red-400 mb-4">{error}</p>}
              
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {loadingComments ? (
                  <p className="text-gray-400">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="text-gray-400">No comments yet. Be the first!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-700 p-3 rounded-lg">
                      <p className="text-gray-200 text-sm">{comment.content}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        by {comment.user.email} on {new Date(comment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              
              {user && (
                <div className="mt-4">
                  <textarea
                    className="w-full p-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:ring-purple-500 focus:border-purple-500"
                    rows="3"
                    placeholder="Leave a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={postingComment}
                  ></textarea>
                  <button
                    onClick={handlePostComment}
                    className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                    disabled={postingComment || !newComment.trim()}
                  >
                    {postingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckViewModal;
