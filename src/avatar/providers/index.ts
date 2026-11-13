import { avaturnProvider } from './avaturn';
import type { AvatarProvider } from './types';

/** Registered providers, in order of preference. Add MetaPerson etc. here. */
export const PROVIDERS: AvatarProvider[] = [avaturnProvider];

export const defaultProvider = PROVIDERS[0];

export type { AvatarProvider, GeneratedAvatar } from './types';
