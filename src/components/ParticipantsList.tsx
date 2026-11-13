import { useState } from 'react';
import { Check, Crown, UserX, X } from 'lucide-react';
import type { Member } from '../lib/types';
import { setMemberStatus } from '../lib/api';
import { Button, errMsg, toast } from './ui';
import AvatarPreview from './AvatarPreview';
import { defaultAvatar } from '../avatar/config';

const LABEL: Record<Member['status'], { t: string; cls: string }> = {
  pending: { t: 'Wants to enter', cls: 'bg-amber-400/15 text-amber-200' },
  accepted: { t: 'Accepted', cls: 'bg-emerald-400/15 text-emerald-200' },
  rejected: { t: 'Declined', cls: 'bg-white/10 text-cream/50' },
  removed: { t: 'Removed', cls: 'bg-red-400/10 text-red-200/70' },
};

export default function ParticipantsList({
  museumId,
  members,
  isHost,
  onChange,
  previews = true,
}: {
  museumId: string;
  members: Member[];
  isHost: boolean;
  onChange: () => void;
  previews?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (m: Member, status: Member['status']) => {
    if (status === 'removed' && !confirm(`Remove ${m.display_name || 'this participant'} from the museum?`)) return;
    setBusy(m.user_id + status);
    try {
      await setMemberStatus(museumId, m.user_id, status);
      if (status === 'accepted') toast(`${m.display_name || 'Guest'} can come in ❤️`, 'love');
      onChange();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const sorted = [...members].sort((a, b) => {
    const order = { host: -1, guest: 0 } as const;
    const s = { pending: 0, accepted: 1, rejected: 2, removed: 3 } as const;
    return order[a.role] - order[b.role] || s[a.status] - s[b.status];
  });

  if (!members.length) return <p className="text-sm text-cream/60">Nobody yet.</p>;

  return (
    <ul className="space-y-3">
      {sorted.map((m) => (
        <li key={m.user_id} className={`flex items-center gap-4 rounded-2xl border p-3 ${m.status === 'pending' ? 'border-rose/40 bg-rose/10 pulse-ring' : 'border-white/10 bg-white/[0.03]'}`}>
          {previews ? (
            <AvatarPreview config={m.avatar ?? defaultAvatar()} className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-wine/50 to-transparent" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wine/50 font-serif text-xl">{(m.display_name || '?')[0]}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-medium">
              {m.role === 'host' && <Crown className="h-4 w-4 text-gold" />}
              {m.display_name || 'Guest'}
            </p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${m.role === 'host' ? 'bg-gold/15 text-champagne' : LABEL[m.status].cls}`}>
              {m.role === 'host' ? 'Host' : LABEL[m.status].t}
            </span>
          </div>
          {isHost && m.role !== 'host' && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {(m.status === 'pending' || m.status === 'rejected' || m.status === 'removed') && (
                <Button size="sm" loading={busy === m.user_id + 'accepted'} onClick={() => act(m, 'accepted')}>
                  <Check className="h-4 w-4" /> Accept
                </Button>
              )}
              {m.status === 'pending' && (
                <Button size="sm" variant="ghost" loading={busy === m.user_id + 'rejected'} onClick={() => act(m, 'rejected')}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              )}
              {m.status === 'accepted' && (
                <Button size="sm" variant="danger" loading={busy === m.user_id + 'removed'} onClick={() => act(m, 'removed')}>
                  <UserX className="h-4 w-4" /> Remove
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
