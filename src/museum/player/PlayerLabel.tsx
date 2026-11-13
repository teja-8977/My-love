import { useEffect, useState } from 'react';
import { WorldHtml } from '../../components/WorldHtml';
import { Crown } from 'lucide-react';
import { CHAT_TTL, useGame } from '../store';

/** Name tag + floating chat bubbles (each visible for 10 seconds). */
export function PlayerLabel({ userId, name, self, host }: { userId: string; name: string; self?: boolean; host?: boolean }) {
  const all = useGame((s) => s.messages);
  const [now, setNow] = useState(() => Date.now());
  const mine = all.filter((m) => m.id === userId && now - m.ts < CHAT_TTL).slice(-3);

  useEffect(() => {
    if (!mine.length) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [mine.length]);

  useEffect(() => setNow(Date.now()), [all.length]);

  return (
    <WorldHtml position={[0, 2.08, 0]} zIndex={20} maxDistance={30}>
      <div className="flex flex-col items-center gap-1.5">
        {mine.map((m) => (
          <div key={m.mid} className="bubble" style={{ opacity: Math.min(1, (CHAT_TTL - (now - m.ts)) / 1200) }}>
            {m.text}
          </div>
        ))}
        <div className="nametag flex items-center gap-1">
          {host && <Crown className="h-3 w-3 text-[#d9b26f]" />}
          {name}
          {self && <span className="opacity-60">(you)</span>}
        </div>
      </div>
    </WorldHtml>
  );
}
