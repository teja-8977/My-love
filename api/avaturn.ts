// Vercel Function (Web API signature). Routes: /api/avaturn?action=photos|status|session|store|delete|config
// Set AVATURN_API_KEY (secret) in Vercel → Project → Settings → Environment Variables.
import { handleAvaturn } from '../server/avaturn';

export const config = { maxDuration: 60 };

const handle = (request: Request) => handleAvaturn(request, process.env as Record<string, string | undefined>);

export const GET = handle;
export const POST = handle;
