import { AvaturnSDK, type ExportAvatarResult } from '@avaturn/sdk';
import type { AvatarProvider } from './types';
import { avatarStatus, avaturnApiEnabled, deleteRemoteAvatar, editorSessionUrl, storeExportOnServer, submitPhotos } from './avaturnApi';

/**
 * Avaturn (https://docs.avaturn.me) — official @avaturn/sdk editor + the Avaturn REST API.
 *
 * Two configurations:
 *  1. API (paid Avaturn plan): set AVATURN_API_KEY on the server (Vercel env / .env.local, never VITE_*).
 *     → our camera screen uploads front + side photos via /api/avaturn, then the editor opens on that avatar.
 *  2. Editor only: set VITE_AVATURN_URL=https://<project>.avaturn.dev (public project URL).
 *     → the Avaturn editor handles camera capture itself.
 */
const projectUrl = (import.meta.env.VITE_AVATURN_URL as string | undefined)?.trim();

export const avaturnProvider: AvatarProvider = {
  id: 'avaturn',
  name: 'Avaturn',
  configHint:
    'Set AVATURN_API_KEY on the server (Avaturn API plan) or VITE_AVATURN_URL=https://<your-project>.avaturn.dev in .env.local, then restart the dev server.',

  async capabilities() {
    const api = await avaturnApiEnabled();
    return { photoUpload: api, editor: api || Boolean(projectUrl) };
  },

  createFromPhotos: (p) => submitPhotos(p),
  photoStatus: (id) => avatarStatus(id),
  storeOnServer: (url, id) => storeExportOnServer(url, id),
  deleteRemote: (id) => deleteRemoteAvatar(id),

  open(container, { onExport, onError, onLoad }, opts) {
    const sdk = new AvaturnSDK();
    let destroyed = false;
    const ready = (async () => {
      const api = await avaturnApiEnabled();
      const url = api ? await editorSessionUrl(opts?.avatarId ? 'edit' : 'auto', opts?.avatarId) : projectUrl;
      if (!url) throw new Error('Avaturn is not configured');
      if (destroyed) return;
      await sdk.init(container, { url, iframeClassName: 'avaturn-iframe' });
      sdk
        .on('load', () => onLoad?.())
        .on('export', (data: ExportAvatarResult) => {
          if (!data?.url) return onError('Avaturn did not return a model. Please try again.');
          onExport({
            provider: 'avaturn',
            avatarId: data.avatarId || opts?.avatarId || `avaturn-${Date.now()}`,
            glbUrl: data.url,
            gender: data.gender,
            bodyId: data.bodyId,
            extra: { urlType: data.urlType, sessionId: data.sessionId, faceAnimations: data.avatarSupportsFaceAnimations },
          });
        })
        .on('error', (e) => onError(e?.message || e?.type || 'Avaturn reported an error'));
    })().catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    return {
      ready,
      destroy: () => {
        destroyed = true;
        try {
          sdk.destroy();
        } catch {
          /* not initialised yet */
        }
        container.innerHTML = '';
      },
    };
  },
};
