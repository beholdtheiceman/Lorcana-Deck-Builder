import React, { useState, useEffect, useRef } from 'react';
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

  const [hubName, setHubName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [joinedHubId, setJoinedHubId] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (user) fetchHubs();
  }, [user]);

  useEffect(() => {
    if (!loading && hubs.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true;
      if (hubs.length === 1) navigate(`/team-hub/${hubs[0].id}`, { replace: true });
    }
  }, [loading, hubs, navigate]);

  const fetchHubs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hubs');
      if (response.ok) setHubs(await response.json());
      else setError('Failed to fetch hubs');
    } catch { setError('Error fetching hubs'); }
    finally { setLoading(false); }
  };

  const createHub = async (e) => {
    e.preventDefault();
    if (!hubName.trim()) return;
    try {
      setLoading(true); setCreateError('');
      const res = await fetch('/api/hubs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hubName }),
      });
      if (res.ok) {
        const created = await res.json();
        setHubs(prev => [...prev, created]);
        setHubName(''); setShowCreateModal(false);
      } else {
        const errData = await res.json();
        setCreateError(errData.error || 'Failed to create hub');
      }
    } catch { setCreateError('Network error — please try again'); }
    finally { setLoading(false); }
  };

  const joinHub = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    try {
      setLoading(true); setJoinError('');
      const res = await fetch('/api/hubs/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
      });
      if (res.ok) {
        const updatedHub = await res.json();
        setHubs(prev => {
          const exists = prev.some(h => h.id === updatedHub.id);
          return exists ? prev.map(h => h.id === updatedHub.id ? updatedHub : h) : [...prev, updatedHub];
        });
        setInviteCode(''); setShowJoinModal(false);
        setJoinedHubId(updatedHub.id); setDisplayName(''); setShowDisplayNameModal(true);
      } else {
        setJoinError((await res.json()).error || 'Failed to join hub');
      }
    } catch { setJoinError('Network error — please try again'); }
    finally { setLoading(false); }
  };

  const regenerateInviteCode = async (hubId) => {
    try {
      const res = await fetch(`/api/hubs/${hubId}/regenerate-invite`, { method: 'POST' });
      if (res.ok) {
        const { inviteCode: newCode } = await res.json();
        setHubs(prev => prev.map(h => h.id === hubId ? { ...h, inviteCode: newCode } : h));
        setError('');
      } else setError((await res.json()).error || 'Failed to regenerate invite code');
    } catch { setError('Error regenerating invite code'); }
  };

  const saveDisplayName = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !joinedHubId) return;
    try {
      setSavingDisplayName(true); setDisplayNameError('');
      const res = await fetch(`/api/hubs/${joinedHubId}/profile`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) {
        setDisplayNameError((await res.json().catch(() => ({}))).error || 'Failed to save display name');
        return;
      }
      setShowDisplayNameModal(false);
      navigate(`/team-hub/${joinedHubId}/roster`);
    } catch { setDisplayNameError('Network error — please try again'); }
    finally { setSavingDisplayName(false); }
  };

  const handleDeleteHub = async () => {
    if (!hubToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/hubs?hubId=${hubToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setHubs(prev => prev.filter(h => h.id !== hubToDelete.id));
        setShowDeleteConfirm(false); setHubToDelete(null); setError('');
      } else setError((await res.json()).error || 'Failed to delete hub');
    } catch { setError('Error deleting hub'); }
    finally { setDeleting(false); }
  };

  const removeMember = async (hubId, memberId) => {
    try {
      const res = await fetch(`/api/hubs/${hubId}/members`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) { fetchHubs(); setError(''); }
      else setError((await res.json()).error || 'Failed to remove member');
    } catch { setError('Error removing member'); }
  };

  const leaveHub = async (hubId) => {
    try {
      const res = await fetch(`/api/hubs/${hubId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      if (res.ok) { setHubs(prev => prev.filter(h => h.id !== hubId)); setError(''); }
      else setError((await res.json()).error || 'Failed to leave hub');
    } catch { setError('Error leaving hub'); }
  };

  const transferOwnership = async () => {
    if (!hubToTransfer || !selectedNewOwner) return;
    try {
      setTransferring(true);
      const res = await fetch(`/api/hubs/${hubToTransfer.id}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer_ownership', newOwnerId: selectedNewOwner }),
      });
      if (res.ok) {
        fetchHubs(); setShowTransferModal(false); setHubToTransfer(null);
        setSelectedNewOwner(''); setError('');
      } else setError((await res.json()).error || 'Failed to transfer ownership');
    } catch { setError('Error transferring ownership'); }
    finally { setTransferring(false); }
  };

  // ---- token-styled primitives (idiom: src/pages/hub/HubOverviewPage.jsx) ----
  const inputCls = 'w-full px-3 py-2 rounded-md border text-sm focus:outline-none transition-colors placeholder:text-[color:var(--faint)]';
  const inputStyle = { borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--text)' };

  const cancelBtnCls = 'px-4 py-2 rounded-md border text-sm font-semibold transition-colors hover:brightness-125';
  const cancelBtnStyle = { borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--muted)' };

  const primaryBtnCls = 'px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-40 transition shrink-0 hover:brightness-110';
  const primaryBtnStyle = { background: 'var(--sapphire)', color: '#0b1620' };

  const errorBoxCls = 'px-3 py-2 rounded-md border text-sm';
  const errorBoxStyle = {
    background: 'color-mix(in srgb, var(--ruby) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--ruby) 40%, transparent)',
    color: 'var(--ruby)',
  };

  const modalCardStyle = { background: 'var(--panel)', borderColor: 'var(--line)' };
  const modalHeadingStyle = { fontWeight: 560, color: 'var(--text)' };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl" style={{ fontWeight: 560, color: 'var(--text)' }}>Team Hub</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowCreateModal(true)} className={primaryBtnCls} style={primaryBtnStyle}>
            Create Hub
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className={cancelBtnCls}
            style={cancelBtnStyle}
          >
            Join Hub
          </button>
        </div>
      </div>

      {error && (
        <div className={`mb-4 ${errorBoxCls}`} style={errorBoxStyle}>
          {error}
        </div>
      )}

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
            <div key={hub.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
              <div className="flex justify-between items-start mb-4 gap-4">
                <div>
                  <h3 className="font-display text-lg" style={{ fontWeight: 560, color: 'var(--text)' }}>{hub.name}</h3>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {hub.members.length + 1} member{hub.members.length !== 0 ? 's' : ''}
                    {hub.owner.id === user.id ? ' · You own this hub' : ` · Owner: ${hub.owner.email}`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: 'var(--faint)' }}>Code:</span>
                    <span className="font-mono text-sm tracking-widest tabular-nums" style={{ color: 'var(--text)' }}>{hub.inviteCode}</span>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/join?code=${hub.inviteCode}`;
                        navigator.clipboard.writeText(url);
                      }}
                      className="text-xs transition-colors hover:brightness-110"
                      style={{ color: 'var(--sapphire)' }}
                      title="Copy invite link"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end shrink-0">
                  {hub.owner.id === user.id && (
                    <>
                      <button
                        onClick={() => regenerateInviteCode(hub.id)}
                        className="px-3 py-1 rounded-md text-xs font-semibold border transition-colors hover:brightness-125"
                        style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--muted)' }}
                      >
                        Regenerate Code
                      </button>
                      <button
                        onClick={() => setHubToDelete(hub) || setShowDeleteConfirm(true)}
                        className="px-3 py-1 rounded-md text-xs font-semibold border transition-colors hover:brightness-125"
                        style={{ color: 'var(--ruby)', background: 'color-mix(in srgb, var(--ruby) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--ruby) 40%, transparent)' }}
                      >
                        Delete Hub
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/team-hub/${hub.id}/roster`)}
                    className="px-3 py-1 rounded-md text-xs font-semibold transition hover:brightness-110"
                    style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                  >
                    View Hub
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--faint)' }}>Members</p>
                <div className="space-y-1.5">
                  <div
                    className="flex items-center justify-between rounded-md px-3 py-2 border"
                    style={{ borderColor: 'color-mix(in srgb, var(--sapphire) 30%, var(--line))', background: 'color-mix(in srgb, var(--sapphire) 8%, transparent)' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {hub.owner.email}
                      <span className="ml-2 text-xs font-normal" style={{ color: 'var(--sapphire)' }}>Owner</span>
                    </span>
                    {hub.owner.id === user.id && hub.members.length > 0 && (
                      <button
                        onClick={() => { setHubToTransfer(hub); setShowTransferModal(true); }}
                        className="px-2 py-1 rounded-md text-xs border transition-colors hover:brightness-125"
                        style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--muted)' }}
                      >
                        Transfer
                      </button>
                    )}
                  </div>

                  {hub.members.map(member => (
                    <div key={member.id} className="flex items-center justify-between rounded-md px-3 py-2 border" style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>
                        {member.displayName || member.user.email}
                        {member.displayName && (
                          <span className="ml-1.5 text-xs" style={{ color: 'var(--faint)' }}>{member.user.email}</span>
                        )}
                      </span>
                      <div className="flex gap-2">
                        {hub.owner.id === user.id && (
                          <button
                            onClick={() => removeMember(hub.id, member.user.id)}
                            className="px-2 py-1 rounded-md text-xs border transition-colors hover:brightness-125"
                            style={{ color: 'var(--ruby)', background: 'color-mix(in srgb, var(--ruby) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--ruby) 40%, transparent)' }}
                          >
                            Remove
                          </button>
                        )}
                        {member.user.id === user.id && (
                          <button
                            onClick={() => leaveHub(hub.id)}
                            className="px-2 py-1 rounded-md text-xs border transition-colors hover:brightness-125"
                            style={{ borderColor: 'var(--line-2)', background: 'var(--panel-2)', color: 'var(--muted)' }}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl border p-6 w-full max-w-md" style={modalCardStyle}>
            <h2 className="font-display text-xl mb-4" style={modalHeadingStyle}>Create New Hub</h2>
            <form onSubmit={createHub} className="space-y-3">
              {createError && (
                <div className={errorBoxCls} style={errorBoxStyle}>{createError}</div>
              )}
              <input
                type="text" placeholder="Hub Name" value={hubName}
                onChange={(e) => setHubName(e.target.value)} className={inputCls} style={inputStyle} required
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowCreateModal(false); setCreateError(''); }} className={cancelBtnCls} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" disabled={loading} className={primaryBtnCls} style={primaryBtnStyle}>{loading ? 'Creating...' : 'Create Hub'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Hub Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl border p-6 w-full max-w-md" style={modalCardStyle}>
            <h2 className="font-display text-xl mb-4" style={modalHeadingStyle}>Join Hub</h2>
            <form onSubmit={joinHub} className="space-y-3">
              {joinError && (
                <div className={errorBoxCls} style={errorBoxStyle}>{joinError}</div>
              )}
              <input
                type="text" placeholder="Invite Code (8 characters)" value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className={`${inputCls} font-mono uppercase tracking-widest text-center text-base`}
                style={inputStyle}
                maxLength={8} required
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowJoinModal(false); setJoinError(''); }} className={cancelBtnCls} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" disabled={loading} className={primaryBtnCls} style={primaryBtnStyle}>{loading ? 'Joining...' : 'Join Hub'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && hubToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl border p-6 w-full max-w-md" style={modalCardStyle}>
            <h2 className="font-display text-xl mb-4" style={modalHeadingStyle}>Delete Team Hub</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>"{hubToDelete.name}"</strong>?
              This action cannot be undone and will remove all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setHubToDelete(null); }} className={cancelBtnCls} style={cancelBtnStyle} disabled={deleting}>Cancel</button>
              <button
                onClick={handleDeleteHub}
                disabled={deleting}
                className="px-4 py-2 rounded-md border text-sm font-semibold disabled:opacity-40 transition-colors hover:brightness-125"
                style={{ color: 'var(--ruby)', background: 'color-mix(in srgb, var(--ruby) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--ruby) 45%, transparent)' }}
              >
                {deleting ? 'Deleting...' : 'Delete Hub'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Join Display Name Modal */}
      {showDisplayNameModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl border p-6 w-full max-w-md" style={modalCardStyle}>
            <h2 className="font-display text-xl mb-1" style={modalHeadingStyle}>Welcome to the hub!</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>Set a display name so your teammates know who you are. You can update this later from the Roster tab.</p>
            <form onSubmit={saveDisplayName} className="space-y-3">
              {displayNameError && (
                <div className={errorBoxCls} style={errorBoxStyle}>{displayNameError}</div>
              )}
              <input
                type="text" placeholder="Your display name (e.g. Larry)" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} maxLength={80} className={inputCls} style={inputStyle} autoFocus
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowDisplayNameModal(false); navigate(`/team-hub/${joinedHubId}/roster`); }} className={cancelBtnCls} style={cancelBtnStyle}>Skip for now</button>
                <button type="submit" disabled={savingDisplayName || !displayName.trim()} className={primaryBtnCls} style={primaryBtnStyle}>
                  {savingDisplayName ? 'Saving...' : 'Save & Enter Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && hubToTransfer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl border p-6 w-full max-w-md" style={modalCardStyle}>
            <h2 className="font-display text-xl mb-4" style={modalHeadingStyle}>Transfer Ownership</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Transfer ownership of <strong style={{ color: 'var(--text)' }}>"{hubToTransfer.name}"</strong> to another member.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>Select New Owner</label>
              <select value={selectedNewOwner} onChange={(e) => setSelectedNewOwner(e.target.value)} className={inputCls} style={inputStyle} disabled={transferring}>
                <option value="">Choose a member...</option>
                {hubToTransfer.members.map(member => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.displayName || member.user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowTransferModal(false); setHubToTransfer(null); setSelectedNewOwner(''); }} className={cancelBtnCls} style={cancelBtnStyle} disabled={transferring}>Cancel</button>
              <button onClick={transferOwnership} disabled={!selectedNewOwner || transferring} className={primaryBtnCls} style={primaryBtnStyle}>
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
