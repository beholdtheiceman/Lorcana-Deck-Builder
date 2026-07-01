import React, { useState, useEffect, useMemo } from 'react';
import { Skeleton, EmptyState, Button } from '../ui';

const input = 'w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm';

/**
 * Practice pods: fixed/persistent groups within a hub. Any member can create
 * pods, rename them, delete them, and add/remove members (flat model).
 */
export default function PodsTab({ hubId, currentUser }) {
  const [pods, setPods] = useState([]);
  const [roster, setRoster] = useState([]); // [{ id (userId), email }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [podsR, memR] = await Promise.all([
          fetch(`/api/hubs/${encodeURIComponent(hubId)}/pods`),
          fetch(`/api/hubs/${encodeURIComponent(hubId)}/members`),
        ]);
        if (!podsR.ok) throw new Error('pods');
        const podsData = await podsR.json();
        if (!cancelled) setPods(Array.isArray(podsData) ? podsData : []);
        if (memR.ok) {
          const m = await memR.json();
          const list = [];
          if (m.owner) list.push({ id: m.owner.id, email: m.owner.email });
          (m.members || []).forEach((x) => list.push({ id: x.userId, email: x.email }));
          if (!cancelled) setRoster(list);
        }
      } catch {
        if (!cancelled) setError('Failed to load pods.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hubId]);

  const emailOf = useMemo(() => {
    const map = {};
    roster.forEach((r) => { map[r.id] = r.email; });
    return map;
  }, [roster]);

  const createPod = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const r = await fetch(`/api/hubs/${encodeURIComponent(hubId)}/pods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!r.ok) throw new Error('create');
      const pod = await r.json();
      setPods((prev) => [...prev, pod]);
      setNewName('');
    } catch {
      setError('Failed to create the pod.');
    } finally {
      setCreating(false);
    }
  };

  const renamePod = async (pod) => {
    const name = window.prompt('Rename pod', pod.name);
    if (!name || !name.trim() || name.trim() === pod.name) return;
    try {
      const r = await fetch(`/api/pods/${pod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!r.ok) throw new Error('rename');
      const updated = await r.json();
      setPods((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setError('Failed to rename the pod.');
    }
  };

  const deletePod = async (id) => {
    setPendingDelete(null);
    const prev = pods;
    setPods((list) => list.filter((p) => p.id !== id));
    try {
      const r = await fetch(`/api/pods/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('delete');
    } catch {
      setPods(prev);
      setError('Failed to delete the pod.');
    }
  };

  const addMember = async (podId, memberId) => {
    if (!memberId) return;
    try {
      const r = await fetch(`/api/pods/${podId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!r.ok) throw new Error('add');
      const added = await r.json();
      setPods((prev) =>
        prev.map((p) =>
          p.id === podId && !p.members.some((m) => m.memberId === added.memberId)
            ? { ...p, members: [...p.members, added] }
            : p
        )
      );
    } catch {
      setError('Failed to add the member.');
    }
  };

  const removeMember = async (podId, memberId) => {
    const prev = pods;
    setPods((list) =>
      list.map((p) => (p.id === podId ? { ...p, members: p.members.filter((m) => m.memberId !== memberId) } : p))
    );
    try {
      const r = await fetch(`/api/pods/${podId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!r.ok) throw new Error('remove');
    } catch {
      setPods(prev);
      setError('Failed to remove the member.');
    }
  };

  if (loading) return <Skeleton variant="block" className="h-24" />;

  return (
    <div className="space-y-4">
      {error && <p className="text-bad text-sm">{error}</p>}

      {/* Create pod */}
      <form onSubmit={createPod} className="flex gap-2">
        <input className={input} value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="New pod name (e.g. Test-Group-A)" />
        <Button variant="primary" type="submit" disabled={creating} className="shrink-0">
          {creating ? 'Adding…' : 'Add pod'}
        </Button>
      </form>

      {pods.length === 0 ? (
        <EmptyState title="No pods yet" description="Create a pod to organize team members." />
      ) : (
        <ul className="space-y-3">
          {pods.map((pod) => {
            const memberIds = new Set(pod.members.map((m) => m.memberId));
            const available = roster.filter((r) => !memberIds.has(r.id));
            return (
              <li key={pod.id} className="bg-gray-800/60 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h5 className="text-gray-100 font-semibold">{pod.name}</h5>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => renamePod(pod)} className="text-gray-500 hover:text-violet-300 text-xs">Rename</button>
                    {pendingDelete === pod.id ? (
                      <>
                        <button onClick={() => deletePod(pod.id)} className="text-red-400 hover:text-red-300 text-xs">Sure?</button>
                        <button onClick={() => setPendingDelete(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                      </>
                    ) : (
                      <button onClick={() => setPendingDelete(pod.id)} className="text-gray-500 hover:text-red-400 text-xs">Delete</button>
                    )}
                  </div>
                </div>

                {pod.members.length === 0 ? (
                  <p className="text-gray-600 text-xs">No members yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pod.members.map((m) => (
                      <span key={m.memberId} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-200">
                        {m.email || emailOf[m.memberId] || 'Unknown'}
                        <button onClick={() => removeMember(pod.id, m.memberId)}
                          className="text-gray-400 hover:text-red-400" title="Remove">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {available.length > 0 && (
                  <select className={`${input} max-w-xs`} value=""
                    onChange={(e) => addMember(pod.id, e.target.value)}>
                    <option value="">+ Add member…</option>
                    {available.map((r) => (
                      <option key={r.id} value={r.id}>{r.email}</option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
