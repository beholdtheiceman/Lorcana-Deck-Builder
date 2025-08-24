import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const TeamHub = () => {
  const { user } = useContext(AuthContext);
  const [hubs, setHubs] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedHub, setSelectedHub] = useState(null);
  const [hubDecks, setHubDecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [hubName, setHubName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (user) {
      fetchHubs();
    }
  }, [user]);

  const fetchHubs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hubs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHubs(data);
      } else {
        setError('Failed to fetch hubs');
      }
    } catch (error) {
      setError('Error fetching hubs');
    } finally {
      setLoading(false);
    }
  };

  const createHub = async (e) => {
    e.preventDefault();
    if (!hubName.trim()) return;

    try {
      setLoading(true);
      const response = await fetch('/api/hubs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: hubName })
      });

      if (response.ok) {
        const newHub = await response.json();
        setHubs(prev => [...prev, newHub]);
        setHubName('');
        setShowCreateModal(false);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create hub');
      }
    } catch (error) {
      setError('Error creating hub');
    } finally {
      setLoading(false);
    }
  };

  const joinHub = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    try {
      setLoading(true);
      const response = await fetch('/api/hubs/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() })
      });

      if (response.ok) {
        const updatedHub = await response.json();
        setHubs(prev => prev.map(hub => 
          hub.id === updatedHub.id ? updatedHub : hub
        ));
        setInviteCode('');
        setShowJoinModal(false);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to join hub');
      }
    } catch (error) {
      setError('Error joining hub');
    } finally {
      setLoading(false);
    }
  };

  const fetchHubDecks = async (hubId) => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/decks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHubDecks(data);
      }
    } catch (error) {
      console.error('Error fetching hub decks:', error);
    }
  };

  const removeMember = async (hubId, userId) => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        // Refresh hubs to get updated member list
        fetchHubs();
      }
    } catch (error) {
      setError('Error removing member');
    }
  };

  const transferOwnership = async (hubId, newOwnerId) => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/members`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ newOwnerId })
      });

      if (response.ok) {
        // Refresh hubs to get updated ownership
        fetchHubs();
      }
    } catch (error) {
      setError('Error transferring ownership');
    }
  };

  const regenerateInviteCode = async (hubId) => {
    // For now, we'll need to implement this in the backend
    // This would require a new API endpoint
    setError('Regenerate invite code not implemented yet');
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Please log in to access Team Hub</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Team Hub</h1>
        <div className="space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Hub
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Join Hub
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-600 text-white rounded-lg">
          {error}
        </div>
      )}

      {/* Hubs List */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading...</p>
        </div>
      ) : hubs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">You haven't joined any hubs yet.</p>
          <p className="text-gray-500 text-sm mt-2">Create a hub or join one to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hubs.map(hub => (
            <div key={hub.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{hub.name}</h3>
                  <p className="text-gray-400 text-sm">
                    Owner: {hub.owner.email}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Members: {hub.members.length + 1} • Invite Code: {hub.inviteCode}
                  </p>
                </div>
                <div className="space-x-2">
                  {hub.owner.id === user.id && (
                    <>
                      <button
                        onClick={() => regenerateInviteCode(hub.id)}
                        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                      >
                        Regenerate Code
                      </button>
                      <button
                        onClick={() => {
                          setSelectedHub(hub);
                          fetchHubDecks(hub.id);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Manage
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSelectedHub(hub);
                      fetchHubDecks(hub.id);
                    }}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                  >
                    View Decks
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="mt-3">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Members:</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
                    {hub.owner.email} (Owner)
                  </span>
                  {hub.members.map(member => (
                    <span key={member.id} className="px-2 py-1 bg-gray-600 text-white rounded text-xs">
                      {member.user.email}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Hub Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Create New Hub</h2>
            <form onSubmit={createHub}>
              <input
                type="text"
                placeholder="Hub Name"
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white mb-4"
                required
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Hub Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Join Hub</h2>
            <form onSubmit={joinHub}>
              <input
                type="text"
                placeholder="Invite Code (8 characters)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white mb-4"
                maxLength={8}
                required
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hub Management Modal */}
      {selectedHub && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">{selectedHub.name} - Management</h2>
              <button
                onClick={() => setSelectedHub(null)}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Members Management */}
            {selectedHub.owner.id === user.id && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white mb-3">Manage Members</h3>
                <div className="space-y-2">
                  {selectedHub.members.map(member => (
                    <div key={member.id} className="flex justify-between items-center p-3 bg-gray-800 rounded">
                      <span className="text-white">{member.user.email}</span>
                      <div className="space-x-2">
                        <button
                          onClick={() => transferOwnership(selectedHub.id, member.user.id)}
                          className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                        >
                          Make Owner
                        </button>
                        <button
                          onClick={() => removeMember(selectedHub.id, member.user.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hub Decks */}
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Team Decks</h3>
              {hubDecks.length === 0 ? (
                <p className="text-gray-400">No decks found in this hub.</p>
              ) : (
                <div className="space-y-2">
                  {hubDecks.map(deck => (
                    <div key={deck.id} className="flex justify-between items-center p-3 bg-gray-800 rounded">
                      <div>
                        <span className="text-white font-medium">{deck.title}</span>
                        <span className="text-gray-400 text-sm ml-3">by {deck.user.email}</span>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {new Date(deck.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamHub;
