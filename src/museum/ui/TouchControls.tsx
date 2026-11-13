import { useRef, useState } from 'react';
import { input } from '../player/input';

/** On-screen joystick + action buttons for touch devices. */
export function TouchControls({ onAction }: { onAction: (a: 'E' | 'F' | 'chat') => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pid = useRef(-1);

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

  const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        onPress();
      }}
      className="flex h-14 w-14 items-center justify-center rounded-full glass-strong text-sm font-semibold text-cream active:scale-95"
    >
      {label}
    </button>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 flex items-end justify-between px-6 [@media(hover:hover)]:hidden">
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
      <div className="pointer-events-auto grid grid-cols-2 gap-3">
        <Btn label="E" onPress={() => onAction('E')} />
        <Btn label="Jump" onPress={() => (input.jumpQueued = true)} />
        <Btn label="💃" onPress={() => onAction('F')} />
        <Btn label="💬" onPress={() => onAction('chat')} />
      </div>
    </div>
  );
}
