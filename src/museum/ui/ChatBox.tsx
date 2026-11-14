import { useEffect, useRef, useState } from 'react';
import { MessageCircleHeart, Send } from 'lucide-react';
import { useGame, CHAT_TTL } from '../store';
import { useTour } from '../context';
import { clearInput } from '../player/input';

export function ChatBox() {
  const { net } = useTour();
  const open = useGame((s) => s.chatOpen);
  const messages = useGame((s) => s.messages);
  const set = useGame((s) => s.set);
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      clearInput();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, open]);

  const send = () => {
    if (text.trim()) net.sendChat(text);
    setText('');
    set({ chatOpen: false });
  };

  const visible = open ? messages.slice(-30) : messages.filter((m) => now - m.ts < CHAT_TTL + 4000).slice(-5);

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 w-[min(360px,calc(100vw-2rem))]">
      <div ref={listRef} className={`mb-2 space-y-1 overflow-y-auto ${open ? 'max-h-60 rounded-2xl glass-strong p-3' : 'max-h-40'}`}>
        {visible.map((m) => (
          <div key={m.mid} className={`text-sm transition-opacity ${open ? '' : 'rounded-xl bg-black/35 px-2.5 py-1 backdrop-blur'}`} style={{ opacity: open ? 1 : Math.max(0, Math.min(1, (CHAT_TTL + 4000 - (now - m.ts)) / 3000)) }}>
            <span className="font-semibold text-blush">{m.name}: </span>
            <span className="text-cream/90">{m.text}</span>
          </div>
        ))}
      </div>
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 rounded-full glass-strong p-1.5 pl-4"
        >
          <input
            ref={inputRef}
            value={text}
            maxLength={280}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setText('');
                set({ chatOpen: false });
              }
            }}
            placeholder="Say something sweet…"
            className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-cream/40"
          />
          <button type="submit" className="rounded-full bg-rose p-2 text-white" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <button onClick={() => set({ chatOpen: true })} className="flex items-center gap-2 rounded-full glass-strong px-4 py-2 text-sm text-cream/80 hover:text-cream">
          <MessageCircleHeart className="h-4 w-4 text-blush" />
          <span className="[@media(hover:none)]:hidden">
            Press <span className="kbd">Enter</span> to chat
          </span>
          <span className="hidden [@media(hover:none)]:inline">Chat</span>
        </button>
      )}
    </div>
  );
}
