import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton, EmptyState } from '../components/ui';

const HubListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hubs, setHubs] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hubToDelete, setHubToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [hubToTransfer, setHubToTransfer] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');

  // Form states
  const [hubName, setHubName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

  // Post-join display name prompt
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [joinedHubId, setJoinedHubId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

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
      setCreateError('');
      const response = await fetch('/api/hubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hubName })
      });

      if (response.ok) {
        const newHub = await response.json();
        setHubs(prev => [...prev, newHub]);
        setHubName('');
        setShowCreateModal(false);
      } else {
        const errorData = await response.json();
        setCreateError(errorData.error || 'Failed to create hub');
      }
    } catch {
      setCreateError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  const joinHub = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    try {
      setLoading(true);
      setJoinError('');
      const response = await fetch('/api/hubs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() })
      });

      if (response.ok) {
        const updatedHub = await response.json();
        setHubs(prev => {
          const exists = prev.some(h => h.id === updatedHub.id);
          return exists ? prev.map(h => h.id === updatedHub.id ? updatedHub : h) : [...prev, updatedHub];
        });
        setInviteCode('');
        setShowJoinModal(false);
        setJoinedHubId(updatedHub.id);
        setDisplayName('');
        setShowDisplayNameModal(true);
      } else {
        const errorData = await response.json();
        setJoinError(errorData.error || 'Failed to join hub');
      }
    } catch {
      setJoinError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  const regenerateInviteCode = async (hubId) => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/regenerate-invite`, { method: 'POST' });
      if (response.ok) {
        const { inviteCode: newCode } = await response.json();
        setHubs(prev => prev.map(hub =>
          hub.id === hubId ? { ...hub, inviteCode: newCode } : hub
        ));
        setError('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to regenerate invite code');
      }
    } catch {
      setError('Error regenerating invite code');
    }
  };

  const saveDisplayName = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !joinedHubId) return;
    try {
      setSavingDisplayName(true);
      setDisplayNameError('');
      const res = await fetch(`/api/hubs/${joinedHubId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDisplayNameError(data.error || 'Failed to save display name');
        return;
      }
      setShowDisplayNameModal(false);
      navigate(`/team-hub/${joinedHubId}/roster`);
    } catch {
      setDisplayNameError('Network error — please try again');
    } finally {
      setSavingDisplayName(false);
    }
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

  const removeMember = async (hubId, memberId) => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memberId })
      });

      if (response.ok) {
        fetchHubs();
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to remove member');
      }
    } catch (error) {
      setError('Error removing member');
    }
  };

  const leaveHub = async (hubId) => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'leave' })
      });

      if (response.ok) {
        setHubs(prev => prev.filter(hub => hub.id !== hubId));
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to leave hub');
      }
    } catch (error) {
      setError('Error leaving hub');
    }
  };

  const transferOwnership = async () => {
    if (!hubToTransfer || !selectedNewOwner) return;

    try {
      setTransferring(true);
      const response = await fetch(`/api/hubs/${hubToTransfer.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'transfer_ownership',
          newOwnerId: selectedNewOwner
        })
      });

      if (response.ok) {
        fetchHubs();
        setShowTransferModal(false);
        setHubToTransfer(null);
        setSelectedNewOwner('');
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to transfer ownership');
      }
    } catch (error) {
      setError('Error transferring ownership');
    } finally {
      setTransferring(false);
    }
  };

  const confirmTransferOwnership = (hub) => {
    setHubToTransfer(hub);
    setShowTransferModal(true);
  };

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
        <Skeleton variant="block" className="h-24" />
      ) : hubs.length === 0 ? (
        <EmptyState
          title="No hubs yet"
          description="Create a hub or join one with an invite code."
          action={{ label: 'Create Hub', onClick: () => setShowCreateModal(true) }}
        />
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
                    onClick={() => navigate(`/team-hub/${hub.id}/roster`)}
                    className="px-3 py-1 bg-violet-600 text-white rounded text-sm hover:bg-violet-700"
                  >
                    View Hub
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="mt-3">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Members:</h4>
                <div className="space-y-2">
                  {/* Owner */}
                  <div className="flex items-center justify-between bg-blue-600 rounded px-3 py-2">
                    <span className="text-white text-sm font-medium">
                      {hub.owner.email} (Owner)
                    </span>
                    <div className="flex gap-2">
                      {hub.owner.id === user.id && hub.members.length > 0 && (
                        <button
                          onClick={() => confirmTransferOwnership(hub)}
                          className="px-2 py-1 bg-blue-700 text-white rounded text-xs hover:bg-blue-800"
                          title="Transfer ownership"
                        >
                          Transfer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Members */}
                  {hub.members.map(member => (
                    <div key={member.id} className="flex items-center justify-between bg-gray-600 rounded px-3 py-2">
                      <span className="text-white text-sm">
                        {member.user.email}
                      </span>
                      <div className="flex gap-2">
                        {hub.owner.id === user.id && (
                          <button
                            onClick={() => removeMember(hub.id, member.user.id)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                            title="Remove member"
                          >
                            Remove
                          </button>
                        )}
                        {member.user.id === user.id && (
                          <button
                            onClick={() => leaveHub(hub.id)}
                            className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                            title="Leave hub"
                          >
                            Leave
                          </button>
                        )}
                      </div>
                    </div>
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
            <form onSubmit={createHub} className="space-y-3">
              {createError && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded-lg text-sm">
                  {createError}
                </div>
              )}
              <input
                type="text"
                placeholder="Hub Name"
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                required
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(''); }}
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
            <form onSubmit={joinHub} className="space-y-3">
              {joinError && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded-lg text-sm">
                  {joinError}
                </div>
              )}
              <input
                type="text"
                placeholder="Invite Code (8 characters)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white font-mono uppercase tracking-widest"
                maxLength={8}
                required
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowJoinModal(false); setJoinError(''); }}
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

      {/* Post-Join Display Name Modal */}
      {showDisplayNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-1">Welcome to the hub!</h2>
            <p className="text-gray-400 text-sm mb-5">
              Set a display name so your teammates know who you are. You can always update this later from the Roster tab.
            </p>
            <form onSubmit={saveDisplayName} className="space-y-3">
              {displayNameError && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded-lg text-sm">
                  {displayNameError}
                </div>
              )}
              <input
                type="text"
                placeholder="Your display name (e.g. Larry)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                autoFocus
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDisplayNameModal(false);
                    navigate(`/team-hub/${joinedHubId}/roster`);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  disabled={savingDisplayName || !displayName.trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 text-sm"
                >
                  {savingDisplayName ? 'Saving...' : 'Save & Enter Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && hubToTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Transfer Ownership</h2>
            <p className="text-gray-300 mb-4">
              Transfer ownership of <strong>"{hubToTransfer.name}"</strong> to another member.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select New Owner:
              </label>
              <select
                value={selectedNewOwner}
                onChange={(e) => setSelectedNewOwner(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white"
                disabled={transferring}
              >
                <option value="">Choose a member...</option>
                {hubToTransfer.members.map(member => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setHubToTransfer(null);
                  setSelectedNewOwner('');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                disabled={transferring}
              >
                Cancel
              </button>
              <button
                onClick={transferOwnership}
                disabled={!selectedNewOwner || transferring}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {transferring ? 'Transferring...' : 'Transfer Ownership'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubListPage;
