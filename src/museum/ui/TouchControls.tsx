import { useEffect, useRef, useState } from 'react';
import { input } from '../player/input';
import { useGame } from '../store';
import { DANCES } from '../../avatar/poses';

export type TouchAction = 'E' | 'F' | 'chat' | 'P' | 'help' | 'mic' | `dance:${number}`;

/** True on phones / tablets, and as soon as anyone touches the screen (some phones report a mouse). */
function useTouchDevice() {
  const [touch, setTouch] = useState(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 0;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (touch) return;
    const on = (e: PointerEvent) => e.pointerType === 'touch' && setTouch(true);
    window.addEventListener('pointerdown', on);
    return () => window.removeEventListener('pointerdown', on);
  }, [touch]);
  return touch;
}

function Btn({ label, sub, onPress, active, wide }: { label: string; sub?: string; onPress: () => void; active?: boolean; wide?: boolean }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex ${wide ? 'w-[4.5rem]' : 'w-14'} h-14 touch-none select-none flex-col items-center justify-center rounded-full text-sm font-semibold leading-none text-cream active:scale-95 ${
        active ? 'bg-rose/80 text-white' : 'glass-strong'
      }`}
    >
      <span className="text-base">{label}</span>
      {sub && <span className="mt-0.5 text-[9px] font-normal uppercase tracking-wider opacity-70">{sub}</span>}
    </button>
  );
}

/** On-screen joystick + a button for every keyboard action (E, Space, Shift, F, 1–4, P, Enter, H). */
export function TouchControls({ onAction }: { onAction: (a: TouchAction) => void }) {
  const touch = useTouchDevice();
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [run, setRun] = useState(input.runToggle);
  const pid = useRef(-1);
  const dancing = useGame((s) => s.dancing);
  const danceStyle = useGame((s) => s.danceStyle);
  const overlay = useGame((s) => s.overlay);
  const chatOpen = useGame((s) => s.chatOpen);

  if (!touch || chatOpen || (overlay && overlay.type !== 'cinema' && overlay.type !== 'music')) return null;

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R;
    let dy = (e.clientY - (r.top + R)) / R;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    input.joy.x = dx;
    input.joy.y = -dy;
    setKnob({ x: dx * R * 0.6, y: dy * R * 0.6 });
  };
  const end = () => {
    pid.current = -1;
    input.joy.x = 0;
    input.joy.y = 0;
    setKnob({ x: 0, y: 0 });
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex items-end justify-between px-4 pb-[env(safe-area-inset-bottom)] sm:px-6">
      <div
        ref={base}
        className="pointer-events-auto relative h-32 w-32 touch-none rounded-full glass-strong"
        onPointerDown={(e) => {
          pid.current = e.pointerId;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => e.pointerId === pid.current && update(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-rose/70" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>

      <div className="pointer-events-auto flex flex-col items-end gap-2.5">
        {dancing && (
          <div className="flex gap-1.5 rounded-full glass-strong p-1">
            {DANCES.map((d) => (
              <button
                key={d.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onAction(`dance:${d.id}`);
                }}
                className={`h-10 w-10 rounded-full text-lg ${danceStyle === d.id ? 'bg-rose/80' : ''}`}
                aria-label={d.name}
              >
                {d.emoji}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2.5">
          <Btn label="📷" sub="Photos" onPress={() => onAction('P')} />
          <Btn label="💬" sub="Chat" onPress={() => onAction('chat')} />
          <Btn label="💃" sub={dancing ? 'Stop' : 'Dance'} active={dancing} onPress={() => onAction('F')} />
          <Btn
            label="🏃"
            sub="Run"
            active={run}
            onPress={() => {
              input.runToggle = !input.runToggle;
              setRun(input.runToggle);
            }}
          />
          <Btn label="⤒" sub="Jump" onPress={() => (input.jumpQueued = true)} />
          <Btn label="E" sub="Use" onPress={() => onAction('E')} />
        </div>
      </div>
    </div>
  );
}
