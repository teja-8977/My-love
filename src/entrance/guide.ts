import { DEFAULT_FEMALE, DEFAULT_MALE, type AvatarConfig } from '../avatar/config';

/** The museum's friendly guide (always the same character). */
export const GUIDE_AVATAR: AvatarConfig = {
  ...DEFAULT_MALE,
  skin: '#d49d74',
  faceShape: 'round',
  eyes: 'round',
  brows: 'soft',
  hair: 'short',
  hairColor: '#d9d4cf',
  facialHair: 'mustache',
  top: 'waistcoat',
  topColor: '#7a1f33',
  accentColor: '#fbf6ee',
  bottom: 'trousers',
  bottomColor: '#2a2420',
  shoes: 'oxford',
  shoeColor: '#2a1a14',
  height: 0.98,
  build: 'average',
  accessories: ['bowtie', 'glasses', 'watch'],
};

/** The welcoming couple at the entrance (before any real participants exist). */
export const WELCOME_COUPLE: { id: 'teja' | 'pranati'; name: string; avatar: AvatarConfig }[] = [
  {
    id: 'teja',
    name: 'Teja',
    avatar: { ...DEFAULT_MALE, skin: '#b97f56', hair: 'short', hairColor: '#1b1210', facialHair: 'beard', top: 'shirt', topColor: '#2f3b52', accentColor: '#f4efe6', bottom: 'jeans', bottomColor: '#3d4a63', shoes: 'sneakers', shoeColor: '#f4efe6', height: 1.06, accessories: ['watch'] },
  },
  {
    id: 'pranati',
    name: 'Pranati',
    avatar: { ...DEFAULT_FEMALE, skin: '#d49d74', hair: 'long', hairColor: '#1b1210', eyes: 'almond', top: 'dress', topColor: '#c9425f', accentColor: '#f2d27a', shoes: 'heels', shoeColor: '#8c2f3c', height: 0.95, accessories: ['necklace', 'earrings', 'flower'] },
  },
];

export const GUIDE_STEPS = [
  'Welcome! ❤️ This is your special place to create and relive beautiful memories together.',
  "First, create your own private museum or join someone else's museum.",
  'Choose your character and customize your appearance.',
  'Wait for everyone to join. Once the host starts the tour, your journey begins!',
];
