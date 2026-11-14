import type { AvatarConfig } from '../avatar/config';

export type MuseumStatus = 'lobby' | 'live' | 'ended';
export type MemberStatus = 'pending' | 'accepted' | 'rejected' | 'removed';

export interface Museum {
  id: string;
  host_id: string;
  name: string;
  partner_names: string;
  welcome_message: string;
  final_message: string;
  invite_code: string;
  /** short code people can type, e.g. 7F3A9C */
  room_code?: string;
  status: MuseumStatus;
  created_at: string;
}

export interface Member {
  museum_id: string;
  user_id: string;
  display_name: string;
  avatar: AvatarConfig | null;
  role: 'host' | 'guest';
  status: MemberStatus;
  created_at: string;
}

export interface MediaItem {
  id: string;
  museum_id: string;
  kind: 'photo' | 'video';
  slot: number;
  storage_path: string;
  caption: string;
  width: number | null;
  height: number | null;
}

/** Media item with a short-lived signed URL resolved for display. */
export interface ResolvedMedia extends MediaItem {
  url: string;
}

export interface InviteInfo {
  museum_id: string;
  name: string;
  partner_names: string;
  host_name: string;
  host_avatar: AvatarConfig | null;
  status: MuseumStatus;
  my_status: MemberStatus | null;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar: AvatarConfig | null;
}

export const PHOTO_SLOTS = 24;
export const VIDEO_SLOTS = 4;
