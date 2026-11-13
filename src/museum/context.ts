import { createContext, useContext } from 'react';
import type { Museum, ResolvedMedia } from '../lib/types';
import type { MuseumNet } from './net/MuseumNet';
import type { CinemaController } from './audio/CinemaController';
import type { MusicEngine } from './audio/MusicEngine';

export interface TourSession {
  museum: Museum;
  net: MuseumNet;
  cinema: CinemaController;
  music: MusicEngine;
  photos: ResolvedMedia[];
  videos: ResolvedMedia[];
  meId: string;
  isHost: boolean;
}

export const TourContext = createContext<TourSession | null>(null);

export function useTour() {
  const t = useContext(TourContext);
  if (!t) throw new Error('useTour outside TourContext');
  return t;
}
