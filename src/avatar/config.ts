export type Gender = 'male' | 'female';
export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'long';
export type EyeStyle = 'round' | 'almond' | 'gentle';
export type BrowStyle = 'soft' | 'bold' | 'arched';
export type FacialHair = 'none' | 'stubble' | 'mustache' | 'beard';
export type HairStyle =
  | 'messy' | 'short' | 'side-part' | 'spiky' | 'buzz' | 'curly'
  | 'bob' | 'long' | 'straight' | 'wavy' | 'bun' | 'ponytail' | 'pigtails' | 'bald';
export type NoseStyle = 'button' | 'straight' | 'wide';
export type MouthStyle = 'smile' | 'grin' | 'soft';
export type TopStyle = 'tshirt' | 'overshirt' | 'shirt' | 'hoodie' | 'kurta' | 'waistcoat' | 'sweater' | 'jacket' | 'blazer' | 'blouse' | 'dress';
export type BottomStyle = 'trousers' | 'jeans' | 'shorts' | 'skirt' | 'long-skirt';
export type ShoeStyle = 'canvas' | 'sneakers' | 'chappals' | 'oxford' | 'loafers' | 'boots' | 'heels';
export type Build = 'slim' | 'average' | 'athletic' | 'curvy';
export type Accessory = 'glasses' | 'sunglasses' | 'hat' | 'necklace' | 'earrings' | 'watch' | 'flower' | 'bowtie';

/** Legacy: a GLB made by the old selfie API. Kept only so old saved data still parses; it is never shown. */
export interface AvatarModelRef {
  provider: string;
  avatarId: string;
  path: string;
  gender?: Gender;
  bodyId?: string;
  v: number;
}

export interface AvatarConfig {
  gender: Gender;
  skin: string;
  faceShape: FaceShape;
  eyes: EyeStyle;
  eyeColor: string;
  brows: BrowStyle;
  nose: NoseStyle;
  mouth: MouthStyle;
  lipColor: string;
  blush: boolean;
  facialHair: FacialHair;
  hair: HairStyle;
  hairColor: string;
  top: TopStyle;
  topColor: string;
  accentColor: string;
  bottom: BottomStyle;
  bottomColor: string;
  shoes: ShoeStyle;
  shoeColor: string;
  height: number; // 0.9 – 1.1
  build: Build;
  accessories: Accessory[];
  model?: AvatarModelRef | null;
}

export const SKIN_TONES = ['#fde6d6', '#f6d3bb', '#f1c7a5', '#e8b892', '#d49d74', '#b97f56', '#94603d', '#6e4429', '#4a2c1b'];
export const HAIR_COLORS = ['#1b1210', '#2a1a14', '#3b2418', '#5c3a21', '#8a5a33', '#c8582e', '#e07a45', '#b7884f', '#e2c08a', '#a8432f', '#d9d4cf', '#2c2d4a', '#c45b84'];
export const EYE_COLORS = ['#4a2c1b', '#5a3b22', '#7a4f2a', '#2f6a8a', '#3d7a52', '#6b7f8c', '#1b1210'];
export const LIP_COLORS = ['#c9837a', '#d77b80', '#d0707a', '#b24a5a', '#8e3848', '#d99a8a'];
export const CLOTH_COLORS = [
  '#f4efe6', '#e3e0dc', '#1c1c22', '#2f3b52', '#5b6e8f', '#4c6a8c', '#8fa6c4', '#355e4a', '#7a8a5a', '#8c2f3c', '#c9425f',
  '#e7a3b5', '#d9a07e', '#d8b48a', '#a0703f', '#6a4b8a', '#c9b7e2', '#f2d27a', '#ffffff', '#3d2b23',
];

export const OPTIONS = {
  gender: [
    { id: 'male', label: 'Boy' },
    { id: 'female', label: 'Girl' },
  ],
  faceShape: [
    { id: 'round', label: 'Round' },
    { id: 'oval', label: 'Oval' },
    { id: 'heart', label: 'Heart' },
    { id: 'square', label: 'Square' },
    { id: 'long', label: 'Long' },
  ],
  eyes: [
    { id: 'round', label: 'Big round' },
    { id: 'almond', label: 'Almond' },
    { id: 'gentle', label: 'Gentle' },
  ],
  brows: [
    { id: 'soft', label: 'Soft' },
    { id: 'bold', label: 'Bold' },
    { id: 'arched', label: 'Arched' },
  ],
  nose: [
    { id: 'button', label: 'Button' },
    { id: 'straight', label: 'Straight' },
    { id: 'wide', label: 'Wide' },
  ],
  mouth: [
    { id: 'smile', label: 'Smile' },
    { id: 'grin', label: 'Big smile' },
    { id: 'soft', label: 'Soft' },
  ],
  facialHair: [
    { id: 'none', label: 'None' },
    { id: 'stubble', label: 'Stubble' },
    { id: 'mustache', label: 'Mustache' },
    { id: 'beard', label: 'Beard' },
  ],
  hair: [
    { id: 'messy', label: 'Messy' },
    { id: 'short', label: 'Short' },
    { id: 'side-part', label: 'Side part' },
    { id: 'spiky', label: 'Spiky' },
    { id: 'buzz', label: 'Buzz' },
    { id: 'curly', label: 'Curly' },
    { id: 'bob', label: 'Bob + bangs' },
    { id: 'long', label: 'Long' },
    { id: 'straight', label: 'Long + bangs' },
    { id: 'wavy', label: 'Wavy' },
    { id: 'bun', label: 'Bun' },
    { id: 'ponytail', label: 'Ponytail' },
    { id: 'pigtails', label: 'Pigtails' },
    { id: 'bald', label: 'Bald' },
  ],
  top: [
    { id: 'tshirt', label: 'T-shirt' },
    { id: 'overshirt', label: 'Open shirt + tee' },
    { id: 'shirt', label: 'Shirt' },
    { id: 'hoodie', label: 'Hoodie' },
    { id: 'kurta', label: 'Kurta' },
    { id: 'sweater', label: 'Sweater' },
    { id: 'jacket', label: 'Jacket' },
    { id: 'waistcoat', label: 'Waistcoat' },
    { id: 'blazer', label: 'Blazer' },
    { id: 'blouse', label: 'Blouse' },
    { id: 'dress', label: 'Dress' },
  ],
  bottom: [
    { id: 'jeans', label: 'Jeans' },
    { id: 'trousers', label: 'Trousers' },
    { id: 'shorts', label: 'Shorts' },
    { id: 'skirt', label: 'Skirt' },
    { id: 'long-skirt', label: 'Long skirt' },
  ],
  shoes: [
    { id: 'canvas', label: 'Canvas high-tops' },
    { id: 'sneakers', label: 'Sneakers' },
    { id: 'chappals', label: 'Chappals' },
    { id: 'oxford', label: 'Formal shoes' },
    { id: 'loafers', label: 'Loafers' },
    { id: 'boots', label: 'Boots' },
    { id: 'heels', label: 'Heels' },
  ],
  build: [
    { id: 'slim', label: 'Slim' },
    { id: 'average', label: 'Average' },
    { id: 'athletic', label: 'Athletic' },
    { id: 'curvy', label: 'Curvy' },
  ],
  accessories: [
    { id: 'glasses', label: 'Glasses' },
    { id: 'sunglasses', label: 'Sunglasses' },
    { id: 'hat', label: 'Hat' },
    { id: 'necklace', label: 'Necklace' },
    { id: 'earrings', label: 'Earrings' },
    { id: 'watch', label: 'Watch' },
    { id: 'flower', label: 'Hair flower' },
    { id: 'bowtie', label: 'Bow tie' },
  ],
} as const;

/** The boy: messy dark hair, open blue shirt over a white tee, jeans and canvas shoes. */
export const DEFAULT_MALE: AvatarConfig = {
  gender: 'male',
  skin: '#f1c7a5',
  faceShape: 'round',
  eyes: 'round',
  eyeColor: '#4a2c1b',
  brows: 'soft',
  nose: 'button',
  mouth: 'smile',
  lipColor: '#c9837a',
  blush: true,
  facialHair: 'none',
  hair: 'messy',
  hairColor: '#2a1a14',
  top: 'overshirt',
  topColor: '#5b6e8f',
  accentColor: '#e3e0dc',
  bottom: 'jeans',
  bottomColor: '#4c6a8c',
  shoes: 'canvas',
  shoeColor: '#e3e0dc',
  height: 1.03,
  build: 'average',
  accessories: [],
};

/** The girl: copper bob with bangs, soft grey tee, light jeans and peach canvas shoes. */
export const DEFAULT_FEMALE: AvatarConfig = {
  gender: 'female',
  skin: '#f6d3bb',
  faceShape: 'round',
  eyes: 'round',
  eyeColor: '#5a3b22',
  brows: 'soft',
  nose: 'button',
  mouth: 'smile',
  lipColor: '#d77b80',
  blush: true,
  facialHair: 'none',
  hair: 'bob',
  hairColor: '#c8582e',
  top: 'tshirt',
  topColor: '#e3e0dc',
  accentColor: '#f4efe6',
  bottom: 'jeans',
  bottomColor: '#8fa6c4',
  shoes: 'canvas',
  shoeColor: '#d9a07e',
  height: 0.97,
  build: 'slim',
  accessories: [],
};

export function defaultAvatar(gender: Gender = 'female'): AvatarConfig {
  return structuredClone(gender === 'male' ? DEFAULT_MALE : DEFAULT_FEMALE);
}

const HEX = /^#[0-9a-f]{6}$/i;

function pick<T extends string>(value: unknown, allowed: readonly { id: string }[], fallback: T): T {
  return typeof value === 'string' && allowed.some((o) => o.id === value) ? (value as T) : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && HEX.test(value) ? value : fallback;
}

/** Validate an avatar coming from the network / database and fill gaps with defaults. */
export function sanitizeAvatar(raw: unknown): AvatarConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base = defaultAvatar(r.gender === 'male' ? 'male' : 'female');
  const accessories = Array.isArray(r.accessories)
    ? (r.accessories.filter((a) => OPTIONS.accessories.some((o) => o.id === a)) as Accessory[])
    : base.accessories;
  return {
    gender: base.gender,
    skin: color(r.skin, base.skin),
    faceShape: pick(r.faceShape, OPTIONS.faceShape, base.faceShape),
    eyes: pick(r.eyes, OPTIONS.eyes, base.eyes),
    eyeColor: color(r.eyeColor, base.eyeColor),
    brows: pick(r.brows, OPTIONS.brows, base.brows),
    nose: pick(r.nose, OPTIONS.nose, base.nose),
    mouth: pick(r.mouth, OPTIONS.mouth, base.mouth),
    lipColor: color(r.lipColor, base.lipColor),
    blush: typeof r.blush === 'boolean' ? r.blush : base.blush,
    facialHair: pick(r.facialHair, OPTIONS.facialHair, base.facialHair),
    hair: pick(r.hair, OPTIONS.hair, base.hair),
    hairColor: color(r.hairColor, base.hairColor),
    top: pick(r.top, OPTIONS.top, base.top),
    topColor: color(r.topColor, base.topColor),
    accentColor: color(r.accentColor, base.accentColor),
    bottom: pick(r.bottom, OPTIONS.bottom, base.bottom),
    bottomColor: color(r.bottomColor, base.bottomColor),
    shoes: pick(r.shoes, OPTIONS.shoes, base.shoes),
    shoeColor: color(r.shoeColor, base.shoeColor),
    height: typeof r.height === 'number' && r.height >= 0.88 && r.height <= 1.12 ? r.height : base.height,
    build: pick(r.build, OPTIONS.build, base.build),
    accessories,
    // the old selfie-API 3D models are no longer used: everyone is the built-in animated character
    model: null,
  };
}

export function randomAvatar(gender?: Gender): AvatarConfig {
  const any = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
  const g: Gender = gender ?? (Math.random() > 0.5 ? 'male' : 'female');
  const a = defaultAvatar(g);
  a.skin = any(SKIN_TONES);
  a.hairColor = any(HAIR_COLORS.slice(0, 10));
  a.eyeColor = any(EYE_COLORS);
  a.faceShape = any(OPTIONS.faceShape).id as FaceShape;
  a.hair = any(g === 'male' ? (['messy', 'short', 'side-part', 'spiky', 'curly'] as HairStyle[]) : (['bob', 'long', 'straight', 'wavy', 'bun', 'ponytail', 'pigtails'] as HairStyle[]));
  a.top = any(g === 'male' ? (['tshirt', 'overshirt', 'hoodie', 'kurta', 'shirt', 'sweater'] as TopStyle[]) : (['tshirt', 'blouse', 'dress', 'hoodie', 'kurta', 'sweater'] as TopStyle[]));
  a.topColor = any(CLOTH_COLORS);
  a.bottomColor = any(CLOTH_COLORS);
  a.shoes = any(OPTIONS.shoes.filter((s) => g === 'female' || s.id !== 'heels')).id as ShoeStyle;
  a.shoeColor = any(CLOTH_COLORS);
  a.height = 0.92 + Math.random() * 0.16;
  return a;
}
