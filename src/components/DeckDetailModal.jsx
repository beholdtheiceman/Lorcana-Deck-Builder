import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const DeckDetailModal = ({ deck, hub, onClose }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (deck) {
      fetchComments();
    }
  }, [deck]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/decks/${deck.id}/comments`);

      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/decks/${deck.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment })
      });

      if (response.ok) {
        const comment = await response.json();
        setComments(prev => [comment, ...prev]);
        setNewComment('');
      } else {
        setError('Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  if (!deck) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
             <div className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                     <div>
             <h2 className="text-2xl font-bold text-white">{deck.title}</h2>
            <p className="text-gray-400">
              by {deck.user.email} • {hub?.name} Hub
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deck Image Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Deck Image</h3>
              <div className="aspect-[3/4] bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-gray-400 text-center">
                  <div className="text-6xl mb-4">🎴</div>
                                     <div className="text-lg">{deck.title}</div>
                                     <div className="text-sm mt-2">
                     {deck.cardCount || 0} cards
                   </div>
                </div>
              </div>
              
              {/* Deck Info */}
              <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                <h4 className="text-white font-semibold mb-2">Deck Details</h4>
                <div className="text-gray-300 text-sm space-y-1">
                  <p>Created: {new Date(deck.createdAt).toLocaleDateString()}</p>
                                     <p>Cards: {deck.cardCount || 0}</p>
                  {deck.description && (
                    <p>Description: {deck.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Comments ({comments.length})
              </h3>
              
              {/* Add Comment Form */}
              <form onSubmit={addComment} className="mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment about this deck..."
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 resize-none"
                  rows="3"
                  disabled={loading}
                />
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !newComment.trim()}
                  className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Posting...' : 'Post Comment'}
                </button>
              </form>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No comments yet. Be the first to share your thoughts!
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">
                            {comment.user.email}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-300">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckDetailModal;
