/**
 * Avatar generation providers (selfie → rigged 3D GLB).
 * The museum only depends on this interface, so a provider (Avaturn, MetaPerson, …)
 * can be swapped without touching the 3D world or multiplayer code.
 */
export interface GeneratedAvatar {
  provider: string;
  avatarId: string;
  /** a URL GLTFLoader/fetch can read: http(s) or data: URL */
  glbUrl: string;
  gender?: 'male' | 'female';
  bodyId?: string;
  extra?: Record<string, unknown>;
}

export interface ProviderSession {
  /** resolves when the editor UI is ready */
  ready: Promise<void>;
  destroy: () => void;
}

export interface ProviderCapabilities {
  /** our own camera screen can send front + side photos to the provider */
  photoUpload: boolean;
  /** the provider's embedded editor is available */
  editor: boolean;
}

export type PhotoStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface AvatarProvider {
  id: string;
  name: string;
  capabilities: () => Promise<ProviderCapabilities>;
  /** human-readable configuration hint when nothing is configured */
  configHint: string;
  /** front + two side photos → provider avatar id (processing starts in the background) */
  createFromPhotos?: (p: { frontal: Blob; side1: Blob; side2: Blob; bodyType: 'male' | 'female' }) => Promise<string>;
  photoStatus?: (avatarId: string) => Promise<PhotoStatus>;
  /**
   * Opens the provider's editor inside `container` — to create an avatar (the editor's own camera capture)
   * or, with `avatarId`, to customise hair / clothes / shoes / glasses of an existing avatar without changing the face.
   */
  open: (
    container: HTMLElement,
    handlers: { onExport: (a: GeneratedAvatar) => void; onError: (message: string) => void; onLoad?: () => void },
    opts?: { avatarId?: string },
  ) => ProviderSession;
  /** copy an exported model into our storage server-side (when the browser can't download it) */
  storeOnServer?: (url: string, avatarId: string) => Promise<string>;
  /** delete the avatar from the provider (privacy) */
  deleteRemote?: (avatarId: string) => Promise<void>;
}
