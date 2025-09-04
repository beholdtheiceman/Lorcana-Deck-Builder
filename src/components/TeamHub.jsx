import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import HubDetailModal from './HubDetailModal';

const TeamHub = () => {
  const { user } = useAuth();
  const [hubs, setHubs] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedHub, setSelectedHub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHubDetail, setShowHubDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hubToDelete, setHubToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      const response = await fetch('/api/hubs');
      
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
          'Content-Type': 'application/json'
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
          'Content-Type': 'application/json'
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

  const regenerateInviteCode = async (hubId) => {
    // For now, we'll need to implement this in the backend
    // This would require a new API endpoint
    setError('Regenerate invite code not implemented yet');
  };

  const handleDeleteHub = async () => {
    if (!hubToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/hubs?hubId=${hubToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setHubs(prev => prev.filter(hub => hub.id !== hubToDelete.id));
        setShowDeleteConfirm(false);
        setHubToDelete(null);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete hub');
      }
    } catch (error) {
      setError('Error deleting hub');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteHub = (hub) => {
    setHubToDelete(hub);
    setShowDeleteConfirm(true);
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
                        onClick={() => confirmDeleteHub(hub)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Delete Hub
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSelectedHub(hub);
                      setShowHubDetail(true);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
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

      {/* Hub Detail Modal */}
      {showHubDetail && selectedHub && (
        <HubDetailModal
          hub={selectedHub}
          onClose={() => {
            setShowHubDetail(false);
            setSelectedHub(null);
          }}
          onDeckClick={(deck) => {
            // The new approach handles deck detail directly in HubDetailModal
            // No additional state management needed here
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && hubToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Delete Team Hub</h2>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete the team hub <strong>"{hubToDelete.name}"</strong>? 
              This action cannot be undone and will remove all associated data.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setHubToDelete(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHub}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Hub'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The new approach handles deck viewing directly in HubDetailModal */}
    </div>
  );
};

export default TeamHub;
