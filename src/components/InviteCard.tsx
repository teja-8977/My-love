import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, RefreshCw, Share2 } from 'lucide-react';
import { Button, toast } from './ui';

/** Draw a heart path into a canvas context, centered at (cx, cy). */
function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const s = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 0.15, cy + s * 0.75, cx - s, cy + s * 0.25, cx - s, cy - s * 0.25);
  ctx.bezierCurveTo(cx - s, cy - s * 0.75, cx - s * 0.4, cy - s * 0.95, cx, cy - s * 0.55);
  ctx.bezierCurveTo(cx + s * 0.4, cy - s * 0.95, cx + s, cy - s * 0.75, cx + s, cy - s * 0.25);
  ctx.bezierCurveTo(cx + s, cy + s * 0.25, cx + s * 0.15, cy + s * 0.75, cx, cy + s * 0.95);
  ctx.closePath();
}

async function drawLoveQR(canvas: HTMLCanvasElement, url: string, title: string) {
  const size = 720;
  canvas.width = size;
  canvas.height = size + 110;
  const ctx = canvas.getContext('2d')!;
  // card background
  ctx.fillStyle = '#fff8f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const margin = 70;
  const cell = (size - margin * 2) / n;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#e8577a');
  grad.addColorStop(1, '#a8325a');
  ctx.fillStyle = grad;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      const x = margin + c * cell;
      const y = margin + r * cell;
      const finder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      if (finder) {
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
      } else {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.46, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // heart badge in the middle (error correction H tolerates ~30% damage)
  const hw = size * 0.2;
  ctx.save();
  ctx.shadowColor = 'rgba(168,50,90,0.35)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#fff8f6';
  heartPath(ctx, size / 2, size / 2, hw * 1.25);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e8577a';
  heartPath(ctx, size / 2, size / 2, hw);
  ctx.fill();

  await document.fonts?.ready;
  ctx.fillStyle = '#8c2f4a';
  ctx.textAlign = 'center';
  ctx.font = '600 44px "Cormorant Garamond", serif';
  ctx.fillText(title.slice(0, 36), size / 2, size + 30);
  ctx.font = '26px "Inter", sans-serif';
  ctx.fillStyle = '#b77088';
  ctx.fillText('scan me ❤', size / 2, size + 76);
}

export default function InviteCard({ url, title, onRegenerate, compact }: { url: string; title: string; onRegenerate?: () => Promise<void>; compact?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [regen, setRegen] = useState(false);

  useEffect(() => {
    if (canvas.current) drawLoveQR(canvas.current, url, title);
  }, [url, title]);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'I made something for you ❤️', text: `Come inside "${title}"`, url });
      } catch {
        /* cancelled */
      }
    } else copy();
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = canvas.current!.toDataURL('image/png');
    a.download = 'love-museum-invite.png';
    a.click();
  };

  return (
    <div className={compact ? 'flex flex-col items-center gap-3' : 'flex flex-col items-center gap-4 sm:flex-row sm:items-start'}>
      <canvas ref={canvas} className={'rounded-2xl shadow-[0_20px_60px_-20px_rgba(232,87,122,0.6)] ' + (compact ? 'w-40' : 'w-56')} />
      <div className="w-full min-w-0 flex-1 space-y-3">
        {/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url) && (
          <p className="rounded-xl border border-amber-300/40 bg-amber-300/10 p-2.5 text-xs text-amber-100">
            This QR code points to <b>localhost</b>, which only works on this computer. Deploy the site (e.g. Vercel) and set
            VITE_PUBLIC_URL, or open the app via your Wi-Fi address (npx vite --host), so phones and other laptops can join.
          </p>
        )}
        {!compact && <p className="text-sm text-cream/70">Share this private link or QR code with your special person. They'll sign in, design their avatar and ask to enter — you decide who comes in.</p>}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2 pl-3">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-blush">{url}</span>
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button size="sm" variant="ghost" onClick={download}>
            <Download className="h-4 w-4" /> QR image
          </Button>
          {onRegenerate && (
            <Button
              size="sm"
              variant="ghost"
              loading={regen}
              onClick={async () => {
                if (!confirm('Create a new link? The old link and QR code will stop working for anyone who has not joined yet.')) return;
                setRegen(true);
                try {
                  await onRegenerate();
                  toast('New invitation link created');
                } finally {
                  setRegen(false);
                }
              }}
            >
              <RefreshCw className="h-4 w-4" /> New link
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
